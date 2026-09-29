"""Adagio Backoffice — HTTP API.

Recruiters manage companies and job postings here; the public job board
(the Adagio Talent site) reads the read-only /api/public/* routes. Auth
mirrors the sibling apps — PBKDF2 password hashing, a signed bearer token,
an admin and a narrower role — so there is one scheme to reason about
across this person's apps.
"""
import json
import os
import re
import unicodedata

from flask import Flask, Response, jsonify, request, send_from_directory
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from db import all_rows, connect, migrate, one, read

import hashlib
import hmac
import secrets

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend", "dist")

APP_SECRET = os.environ.get("APP_SECRET") or "dev-secret-change-me"
PBKDF2_ITERATIONS = 310_000
SESSION_MAX_AGE = 8 * 3600

app = Flask(__name__, static_folder=None)
_signer = URLSafeTimedSerializer(APP_SECRET, salt="adagio-session")

ROLES = {"admin", "recruiter"}
ARRANGEMENTS = {"remote", "hybrid", "on-site"}
EMPLOYMENT_TYPES = {"full-time", "part-time", "contract"}
STATUSES = {"draft", "published", "paused", "closed", "archived"}
TRANSITIONS = {
    "draft": ["published"],
    "published": ["paused", "closed"],
    "paused": ["published", "closed"],
    "closed": ["archived"],
    "archived": [],
}
LIST_FIELDS = ["responsibilities", "requirements", "preferred_qualifications", "benefits", "tags"]


# ── Small helpers ────────────────────────────────────────────────────────

def fail(message: str, status: int = 400):
    return jsonify({"error": message}), status


def body() -> dict:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def client_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    return forwarded.split(",")[0].strip() or request.remote_addr or ""


def bearer() -> str:
    header = request.headers.get("Authorization", "")
    return header[7:].strip() if header.lower().startswith("bearer ") else ""


def hash_password(password: str, salt: str = None) -> str:
    salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${dk.hex()}"


def check_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt, digest = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations))
        return hmac.compare_digest(dk.hex(), digest)
    except (ValueError, AttributeError):
        return False


def iso(value):
    return value.isoformat() if value is not None and hasattr(value, "isoformat") else value


def slugify(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value)).encode("ascii", "ignore").decode()
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def unique_slug(conn, table: str, base: str, exclude_id=None) -> str:
    candidate = slugify(base)
    root = candidate
    n = 2
    while True:
        if exclude_id:
            clash = one(
                conn,
                f"SELECT id FROM {table} WHERE slug = %s AND id != %s AND deleted_at IS NULL",
                (candidate, exclude_id),
            )
        else:
            clash = one(
                conn,
                f"SELECT id FROM {table} WHERE slug = %s AND deleted_at IS NULL",
                (candidate,),
            )
        if not clash:
            return candidate
        candidate = f"{root}-{n}"
        n += 1


def audit(conn, user, action, entity_type, entity_id, entity_name, details=None):
    conn.execute(
        """
        INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id,
                                entity_name, details, ip)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (user["id"], user["name"], action, entity_type, str(entity_id) if entity_id else None,
         entity_name, json.dumps(details) if details else None, client_ip()),
    )


def clean_list(value) -> list:
    if not isinstance(value, list):
        return []
    return [str(v) for v in value if str(v).strip()]


def public_user(row: dict) -> dict:
    return {"id": str(row["id"]), "name": row["name"], "email": row["email"], "role": row["role"]}


# ── Auth ─────────────────────────────────────────────────────────────────

def current_user():
    token = bearer()
    if not token:
        return None
    try:
        data = _signer.loads(token, max_age=SESSION_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None
    with read() as conn:
        return one(conn, "SELECT id, name, email, role FROM app_user WHERE id = %s AND active",
                   (data.get("uid"),))


def require_user(role=None):
    user = current_user()
    if not user:
        return None, fail("No autenticado", 401)
    if role == "admin" and user["role"] != "admin":
        return None, fail("Se requiere rol Administrador", 403)
    return user, None


# ════════════════════════════════════════════════════════════════════════
#  PUBLIC API — read-only, no auth required
# ════════════════════════════════════════════════════════════════════════

def public_job_summary(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "slug": row["slug"],
        "title": row["title"],
        "company": {
            "name": row["company_name"],
            "logo": row["company_logo"],
            "description": row["company_desc"],
        },
        "location": row["location"],
        "country": row["country"],
        "arrangement": row["work_arrangement"],
        "employmentType": row["employment_type"],
        "department": row["department"],
        "shortDescription": row["short_description"],
        "tags": row["tags"] or [],
        "datePosted": iso(row["published_at"]),
        "status": "active",
    }


@app.get("/api/public/jobs")
def public_jobs():
    args = request.args
    sql = """
        SELECT j.id, j.slug, j.title, j.department, j.location, j.country,
               j.work_arrangement, j.employment_type, j.short_description,
               j.tags, j.published_at,
               c.name AS company_name, c.logo_url AS company_logo, c.description AS company_desc
        FROM job j JOIN company c ON c.id = j.company_id
        WHERE j.status = 'published' AND j.deleted_at IS NULL AND c.deleted_at IS NULL
    """
    params = []
    if args.get("q"):
        sql += " AND (j.title ILIKE %s OR j.short_description ILIKE %s)"
        params += [f"%{args['q']}%", f"%{args['q']}%"]
    if args.get("arrangement"):
        sql += " AND j.work_arrangement = %s"
        params.append(args["arrangement"])
    if args.get("employmentType"):
        sql += " AND j.employment_type = %s"
        params.append(args["employmentType"])
    if args.get("company"):
        sql += " AND c.slug = %s"
        params.append(args["company"])
    if args.get("department"):
        sql += " AND j.department = %s"
        params.append(args["department"])
    if args.get("country"):
        sql += " AND j.country = %s"
        params.append(args["country"])
    sql += " ORDER BY j.published_at DESC"

    with read() as conn:
        rows = all_rows(conn, sql, params)
    total = len(rows)
    try:
        page = max(1, int(args.get("page", 1)))
    except ValueError:
        page = 1
    try:
        limit = min(100, max(1, int(args.get("limit", 20))))
    except ValueError:
        limit = 20
    items = [public_job_summary(r) for r in rows[(page - 1) * limit: page * limit]]
    return jsonify({"total": total, "page": page, "limit": limit, "items": items})


@app.get("/api/public/jobs/<slug>")
def public_job_detail(slug):
    with read() as conn:
        r = one(
            conn,
            """
            SELECT j.*, c.name AS company_name, c.logo_url AS company_logo, c.description AS company_desc
            FROM job j JOIN company c ON c.id = j.company_id
            WHERE j.slug = %s AND j.status = 'published' AND j.deleted_at IS NULL AND c.deleted_at IS NULL
            """,
            (slug,),
        )
    if not r:
        return fail("Vacante no encontrada", 404)
    return jsonify({
        "id": str(r["id"]), "slug": r["slug"], "title": r["title"],
        "company": {"name": r["company_name"], "logo": r["company_logo"], "description": r["company_desc"]},
        "location": r["location"], "country": r["country"],
        "arrangement": r["work_arrangement"], "employmentType": r["employment_type"],
        "department": r["department"], "shortDescription": r["short_description"],
        "description": r["description"],
        "responsibilities": r["responsibilities"] or [],
        "requirements": r["requirements"] or [],
        "preferredQualifications": r["preferred_qualifications"] or [],
        "benefits": r["benefits"] or [],
        "tags": r["tags"] or [],
        "applicationUrl": r["application_url"],
        "datePosted": iso(r["published_at"]),
        "status": "active",
    })


# ════════════════════════════════════════════════════════════════════════
#  AUTH
# ════════════════════════════════════════════════════════════════════════

@app.post("/api/auth/login")
def login():
    data = body()
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    if not email or not password:
        return fail("Campos requeridos", 400)
    with connect() as conn:
        user = one(conn, "SELECT * FROM app_user WHERE email = %s AND active", (email,))
        if not user or not check_password(password, user["password_hash"]):
            return fail("Credenciales incorrectas", 401)
        audit(conn, user, "LOGIN", "user", user["id"], user["name"])
    token = _signer.dumps({"uid": str(user["id"])})
    return jsonify({"token": token, "user": public_user(user)})


@app.get("/api/auth/me")
def me():
    user, error = require_user()
    return error or jsonify(public_user(user))


# ════════════════════════════════════════════════════════════════════════
#  USERS (Admin only)
# ════════════════════════════════════════════════════════════════════════

@app.get("/api/users")
def list_users():
    user, error = require_user("admin")
    if error:
        return error
    with read() as conn:
        rows = all_rows(conn, "SELECT id, name, email, role, active, created_at FROM app_user ORDER BY name")
    return jsonify([{**r, "id": str(r["id"]), "created_at": iso(r["created_at"])} for r in rows])


@app.post("/api/users")
def create_user():
    admin, error = require_user("admin")
    if error:
        return error
    data = body()
    name = str(data.get("name") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    role = data.get("role")
    if not name or not email or not password or not role:
        return fail("Campos requeridos", 400)
    if role not in ROLES:
        return fail("Rol inválido", 400)
    if len(password) < 8:
        return fail("La contraseña debe tener al menos 8 caracteres", 400)
    with connect() as conn:
        if one(conn, "SELECT id FROM app_user WHERE email = %s", (email,)):
            return fail("El correo ya está en uso", 409)
        created = one(
            conn,
            "INSERT INTO app_user (name, email, password_hash, role) VALUES (%s,%s,%s,%s) RETURNING id",
            (name, email, hash_password(password), role),
        )
        audit(conn, admin, "CREATE_USER", "user", created["id"], name, {"role": role})
    return jsonify({"id": str(created["id"])}), 201


@app.put("/api/users/<user_id>")
def update_user(user_id):
    admin, error = require_user("admin")
    if error:
        return error
    data = body()
    with connect() as conn:
        target = one(conn, "SELECT * FROM app_user WHERE id = %s", (user_id,))
        if not target:
            return fail("Usuario no encontrado", 404)
        sets, params = [], []
        if data.get("name"):
            sets.append("name = %s"); params.append(data["name"].strip())
        if data.get("email"):
            sets.append("email = %s"); params.append(data["email"].strip().lower())
        if data.get("role") in ROLES:
            sets.append("role = %s"); params.append(data["role"])
        if "active" in data:
            sets.append("active = %s"); params.append(bool(data["active"]))
        if data.get("password"):
            if len(data["password"]) < 8:
                return fail("Contraseña muy corta", 400)
            sets.append("password_hash = %s"); params.append(hash_password(data["password"]))
        if not sets:
            return fail("Nada que actualizar", 400)
        sets.append("updated_at = now()")
        params.append(user_id)
        conn.execute(f"UPDATE app_user SET {', '.join(sets)} WHERE id = %s", params)
        audit(conn, admin, "UPDATE_USER", "user", user_id, target["name"])
    return jsonify({"ok": True})


# ════════════════════════════════════════════════════════════════════════
#  COMPANIES
# ════════════════════════════════════════════════════════════════════════

COMPANY_FIELDS = ["name", "industry", "website", "logo_url", "description",
                   "contact_person", "contact_email", "contact_phone", "notes"]


@app.get("/api/companies")
def list_companies():
    user, error = require_user()
    if error:
        return error
    with read() as conn:
        rows = all_rows(
            conn,
            """
            SELECT c.*, COUNT(j.id) AS job_count FROM company c
            LEFT JOIN job j ON j.company_id = c.id AND j.deleted_at IS NULL
            WHERE c.deleted_at IS NULL GROUP BY c.id ORDER BY c.name
            """,
        )
    return jsonify([{**r, "id": str(r["id"]),
                     "created_at": iso(r["created_at"]), "updated_at": iso(r["updated_at"])}
                    for r in rows])


@app.get("/api/companies/<company_id>")
def get_company(company_id):
    user, error = require_user()
    if error:
        return error
    with read() as conn:
        row = one(conn, "SELECT * FROM company WHERE id = %s AND deleted_at IS NULL", (company_id,))
    if not row:
        return fail("Empresa no encontrada", 404)
    return jsonify({**row, "id": str(row["id"]),
                    "created_at": iso(row["created_at"]), "updated_at": iso(row["updated_at"])})


@app.post("/api/companies")
def create_company():
    user, error = require_user()
    if error:
        return error
    data = body()
    name = str(data.get("name") or "").strip()
    if not name:
        return fail("El nombre es requerido", 400)
    with connect() as conn:
        slug = unique_slug(conn, "company", name)
        created = one(
            conn,
            """
            INSERT INTO company (slug, name, industry, website, logo_url, description,
                                  contact_person, contact_email, contact_phone, notes)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """,
            (slug, name, data.get("industry") or None, data.get("website") or None,
             data.get("logo_url") or None, data.get("description") or None,
             data.get("contact_person") or None, data.get("contact_email") or None,
             data.get("contact_phone") or None, data.get("notes") or None),
        )
        audit(conn, user, "CREATE_COMPANY", "company", created["id"], name)
    return jsonify({"id": str(created["id"]), "slug": slug}), 201


@app.put("/api/companies/<company_id>")
def update_company(company_id):
    user, error = require_user()
    if error:
        return error
    data = body()
    with connect() as conn:
        company = one(conn, "SELECT * FROM company WHERE id = %s AND deleted_at IS NULL", (company_id,))
        if not company:
            return fail("Empresa no encontrada", 404)
        sets, params = [], []
        for f in COMPANY_FIELDS:
            if f in data:
                sets.append(f"{f} = %s"); params.append(data[f] or None)
        if data.get("slug"):
            sets.append("slug = %s"); params.append(unique_slug(conn, "company", data["slug"], company_id))
        sets.append("updated_at = now()")
        params.append(company_id)
        conn.execute(f"UPDATE company SET {', '.join(sets)} WHERE id = %s", params)
        audit(conn, user, "UPDATE_COMPANY", "company", company_id, company["name"])
    return jsonify({"ok": True})


@app.delete("/api/companies/<company_id>")
def delete_company(company_id):
    admin, error = require_user("admin")
    if error:
        return error
    with connect() as conn:
        company = one(conn, "SELECT * FROM company WHERE id = %s AND deleted_at IS NULL", (company_id,))
        if not company:
            return fail("Empresa no encontrada", 404)
        active = all_rows(
            conn,
            "SELECT id FROM job WHERE company_id = %s AND deleted_at IS NULL AND status = 'published'",
            (company_id,),
        )
        if active:
            return fail("La empresa tiene vacantes publicadas. Ciérralas primero.", 409)
        conn.execute("UPDATE company SET deleted_at = now() WHERE id = %s", (company_id,))
        audit(conn, admin, "DELETE_COMPANY", "company", company_id, company["name"])
    return jsonify({"ok": True})


# ════════════════════════════════════════════════════════════════════════
#  JOBS
# ════════════════════════════════════════════════════════════════════════

def serialize_job(row: dict) -> dict:
    return {
        **row,
        "id": str(row["id"]),
        "company_id": str(row["company_id"]),
        "created_by": str(row["created_by"]) if row.get("created_by") else None,
        "published_at": iso(row.get("published_at")),
        "created_at": iso(row["created_at"]),
        "updated_at": iso(row["updated_at"]),
        "responsibilities": row.get("responsibilities") or [],
        "requirements": row.get("requirements") or [],
        "preferred_qualifications": row.get("preferred_qualifications") or [],
        "benefits": row.get("benefits") or [],
        "tags": row.get("tags") or [],
    }


@app.get("/api/jobs")
def list_jobs():
    user, error = require_user()
    if error:
        return error
    args = request.args
    sql = """
        SELECT j.*, c.name AS company_name FROM job j
        JOIN company c ON c.id = j.company_id
        WHERE j.deleted_at IS NULL AND c.deleted_at IS NULL
    """
    params = []
    if args.get("status"):
        sql += " AND j.status = %s"; params.append(args["status"])
    if args.get("company_id"):
        sql += " AND j.company_id = %s"; params.append(args["company_id"])
    if args.get("q"):
        sql += " AND (j.title ILIKE %s OR j.department ILIKE %s)"
        params += [f"%{args['q']}%", f"%{args['q']}%"]
    sql += " ORDER BY j.updated_at DESC"
    with read() as conn:
        rows = all_rows(conn, sql, params)
    return jsonify([serialize_job(r) for r in rows])


@app.get("/api/jobs/<job_id>")
def get_job(job_id):
    user, error = require_user()
    if error:
        return error
    with read() as conn:
        r = one(
            conn,
            """SELECT j.*, c.name AS company_name FROM job j
               JOIN company c ON c.id = j.company_id WHERE j.id = %s AND j.deleted_at IS NULL""",
            (job_id,),
        )
    if not r:
        return fail("Vacante no encontrada", 404)
    return jsonify(serialize_job(r))


@app.post("/api/jobs")
def create_job():
    user, error = require_user()
    if error:
        return error
    data = body()
    title = str(data.get("title") or "").strip()
    company_id = data.get("company_id")
    if not title or not company_id:
        return fail("title y company_id son requeridos", 400)
    with connect() as conn:
        if not one(conn, "SELECT id FROM company WHERE id = %s AND deleted_at IS NULL", (company_id,)):
            return fail("Empresa no encontrada", 400)
        slug = unique_slug(conn, "job", data.get("slug") or title)
        created = one(
            conn,
            """
            INSERT INTO job (slug, title, company_id, department, location, country,
                              work_arrangement, employment_type, short_description, description,
                              responsibilities, requirements, preferred_qualifications, benefits,
                              tags, application_url, created_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """,
            (slug, title, company_id, data.get("department") or None, data.get("location") or None,
             data.get("country") or "México",
             data.get("work_arrangement") if data.get("work_arrangement") in ARRANGEMENTS else "on-site",
             data.get("employment_type") if data.get("employment_type") in EMPLOYMENT_TYPES else "full-time",
             data.get("short_description") or None, data.get("description") or None,
             clean_list(data.get("responsibilities")), clean_list(data.get("requirements")),
             clean_list(data.get("preferred_qualifications")), clean_list(data.get("benefits")),
             clean_list(data.get("tags")), data.get("application_url") or None, user["id"]),
        )
        audit(conn, user, "CREATE_JOB", "job", created["id"], title, {"slug": slug})
    return jsonify({"id": str(created["id"]), "slug": slug}), 201


@app.put("/api/jobs/<job_id>")
def update_job(job_id):
    user, error = require_user()
    if error:
        return error
    data = body()
    with connect() as conn:
        job = one(conn, "SELECT * FROM job WHERE id = %s AND deleted_at IS NULL", (job_id,))
        if not job:
            return fail("Vacante no encontrada", 404)
        if job["status"] == "archived":
            return fail("No se pueden editar vacantes archivadas", 409)
        sets, params = [], []
        for f in ["title", "department", "location", "country", "short_description",
                  "description", "application_url"]:
            if f in data:
                sets.append(f"{f} = %s"); params.append(data[f] or None)
        if "work_arrangement" in data and data["work_arrangement"] in ARRANGEMENTS:
            sets.append("work_arrangement = %s"); params.append(data["work_arrangement"])
        if "employment_type" in data and data["employment_type"] in EMPLOYMENT_TYPES:
            sets.append("employment_type = %s"); params.append(data["employment_type"])
        for f in LIST_FIELDS:
            if f in data:
                sets.append(f"{f} = %s"); params.append(clean_list(data[f]))
        if data.get("slug"):
            sets.append("slug = %s"); params.append(unique_slug(conn, "job", data["slug"], job_id))
        if data.get("company_id"):
            if not one(conn, "SELECT id FROM company WHERE id = %s AND deleted_at IS NULL", (data["company_id"],)):
                return fail("Empresa no encontrada", 400)
            sets.append("company_id = %s"); params.append(data["company_id"])
        sets.append("updated_at = now()")
        params.append(job_id)
        conn.execute(f"UPDATE job SET {', '.join(sets)} WHERE id = %s", params)
        audit(conn, user, "UPDATE_JOB", "job", job_id, job["title"])
    return jsonify({"ok": True})


@app.post("/api/jobs/<job_id>/status")
def change_job_status(job_id):
    user, error = require_user()
    if error:
        return error
    status = body().get("status")
    with connect() as conn:
        job = one(conn, "SELECT * FROM job WHERE id = %s AND deleted_at IS NULL", (job_id,))
        if not job:
            return fail("Vacante no encontrada", 404)
        if status not in TRANSITIONS.get(job["status"], []):
            return fail(f"No se puede pasar de '{job['status']}' a '{status}'", 409)
        if status == "published":
            conn.execute("UPDATE job SET status = %s, published_at = now(), updated_at = now() WHERE id = %s",
                        (status, job_id))
        else:
            conn.execute("UPDATE job SET status = %s, updated_at = now() WHERE id = %s", (status, job_id))
        audit(conn, user, f"STATUS_{status.upper()}", "job", job_id, job["title"],
              {"from": job["status"], "to": status})
    return jsonify({"ok": True, "status": status})


@app.post("/api/jobs/<job_id>/duplicate")
def duplicate_job(job_id):
    user, error = require_user()
    if error:
        return error
    with connect() as conn:
        job = one(conn, "SELECT * FROM job WHERE id = %s AND deleted_at IS NULL", (job_id,))
        if not job:
            return fail("Vacante no encontrada", 404)
        new_title = f"{job['title']} (copia)"
        new_slug = unique_slug(conn, "job", new_title)
        created = one(
            conn,
            """
            INSERT INTO job (slug, title, company_id, department, location, country,
                              work_arrangement, employment_type, short_description, description,
                              responsibilities, requirements, preferred_qualifications, benefits,
                              tags, application_url, status, created_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'draft',%s) RETURNING id
            """,
            (new_slug, new_title, job["company_id"], job["department"], job["location"], job["country"],
             job["work_arrangement"], job["employment_type"], job["short_description"], job["description"],
             job["responsibilities"], job["requirements"], job["preferred_qualifications"], job["benefits"],
             job["tags"], job["application_url"], user["id"]),
        )
        audit(conn, user, "DUPLICATE_JOB", "job", created["id"], new_title, {"source": str(job_id)})
    return jsonify({"id": str(created["id"]), "slug": new_slug}), 201


@app.delete("/api/jobs/<job_id>")
def delete_job(job_id):
    admin, error = require_user("admin")
    if error:
        return error
    with connect() as conn:
        job = one(conn, "SELECT * FROM job WHERE id = %s AND deleted_at IS NULL", (job_id,))
        if not job:
            return fail("Vacante no encontrada", 404)
        conn.execute("UPDATE job SET deleted_at = now(), status = 'closed' WHERE id = %s", (job_id,))
        audit(conn, admin, "DELETE_JOB", "job", job_id, job["title"])
    return jsonify({"ok": True})


# ════════════════════════════════════════════════════════════════════════
#  AUDIT LOG
# ════════════════════════════════════════════════════════════════════════

@app.get("/api/audit")
def list_audit():
    admin, error = require_user("admin")
    if error:
        return error
    args = request.args
    sql = "SELECT * FROM audit_log WHERE 1=1"
    params = []
    if args.get("entity_type"):
        sql += " AND entity_type = %s"; params.append(args["entity_type"])
    if args.get("entity_id"):
        sql += " AND entity_id = %s"; params.append(args["entity_id"])
    sql += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
    try:
        limit = min(500, max(1, int(args.get("limit", 200))))
    except ValueError:
        limit = 200
    try:
        offset = max(0, int(args.get("offset", 0)))
    except ValueError:
        offset = 0
    params += [limit, offset]
    with read() as conn:
        rows = all_rows(conn, sql, params)
    return jsonify([
        {**r, "id": str(r["id"]), "user_id": str(r["user_id"]) if r["user_id"] else None,
         "created_at": iso(r["created_at"]),
         "details": json.dumps(r["details"]) if r["details"] is not None else None}
        for r in rows
    ])


# ════════════════════════════════════════════════════════════════════════
#  STATS
# ════════════════════════════════════════════════════════════════════════

@app.get("/api/stats")
def stats():
    user, error = require_user()
    if error:
        return error
    with read() as conn:
        total_jobs = one(conn, "SELECT COUNT(*) AS n FROM job WHERE deleted_at IS NULL")["n"]
        published = one(conn, "SELECT COUNT(*) AS n FROM job WHERE status='published' AND deleted_at IS NULL")["n"]
        draft = one(conn, "SELECT COUNT(*) AS n FROM job WHERE status='draft' AND deleted_at IS NULL")["n"]
        paused = one(conn, "SELECT COUNT(*) AS n FROM job WHERE status='paused' AND deleted_at IS NULL")["n"]
        companies = one(conn, "SELECT COUNT(*) AS n FROM company WHERE deleted_at IS NULL")["n"]
        recent = all_rows(
            conn,
            """
            SELECT j.id, j.slug, j.title, j.status, j.updated_at, c.name AS company_name
            FROM job j JOIN company c ON c.id = j.company_id
            WHERE j.deleted_at IS NULL ORDER BY j.updated_at DESC LIMIT 5
            """,
        )
    return jsonify({
        "total_jobs": total_jobs, "published": published, "draft": draft,
        "paused": paused, "companies": companies,
        "recent": [{**r, "id": str(r["id"]), "updated_at": iso(r["updated_at"])} for r in recent],
    })


@app.get("/api/health")
def health():
    with read() as conn:
        conn.execute("SELECT 1")
    return jsonify({"ok": True})


# ── Static frontend ──────────────────────────────────────────────────────

@app.get("/", defaults={"path": ""})
@app.get("/<path:path>")
def frontend(path):
    if path.startswith("api/"):
        return fail("Not found", 404)
    full = os.path.join(FRONTEND_DIR, path)
    if path and os.path.isfile(full):
        return send_from_directory(FRONTEND_DIR, path)
    index = os.path.join(FRONTEND_DIR, "index.html")
    if not os.path.exists(index):
        return Response("Frontend not built. Run: cd frontend && npm run build\n", mimetype="text/plain")
    return send_from_directory(FRONTEND_DIR, "index.html")


# ── Startup ──────────────────────────────────────────────────────────────

def bootstrap():
    """Migrate, then make sure someone can log in.

    The seed account is only consulted while the user table is empty, so the
    environment variables stop mattering the moment a real account exists.
    """
    migrate()
    with connect() as conn:
        count = conn.execute("SELECT count(*) FROM app_user").fetchone()[0]
        if count == 0:
            email = os.environ.get("ADMIN_EMAIL", "admin@adagiotalent.mx")
            password = os.environ.get("ADMIN_PASSWORD", "Admin123!")
            # ON CONFLICT DO NOTHING: gunicorn boots multiple workers that
            # each import this module and race to seed the same admin row.
            created = conn.execute(
                "INSERT INTO app_user (name, email, password_hash, role) "
                "VALUES (%s,%s,%s,'admin') ON CONFLICT (email) DO NOTHING RETURNING id",
                ("Administrador", email.lower(), hash_password(password)),
            ).fetchone()
            if created:
                print(f"  created initial admin '{email}' — change the password")


bootstrap()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "3000")), debug=True)
