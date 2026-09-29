"""End-to-end walk through the backoffice, against a real database.

Skipped unless ADAGIO_TEST_DATABASE_URL points at a database this test may
own — it migrates it and writes to it. A disposable container is the
intended use:

    docker run -d --name adagio-dev-pg -e POSTGRES_PASSWORD=dev \\
        -e POSTGRES_DB=adagio -p 127.0.0.1:55434:5432 postgres:17
    ADAGIO_TEST_DATABASE_URL=postgresql://postgres:dev@127.0.0.1:55434/adagio \\
        python3 -m unittest tests.test_api -v
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

TEST_DB = os.environ.get("ADAGIO_TEST_DATABASE_URL")
if TEST_DB:
    os.environ["DATABASE_URL"] = TEST_DB
    os.environ.setdefault("APP_SECRET", "test-secret")


def ensure_test_admin(application):
    """An account the suite owns, reset on every run."""
    from db import connect

    email, password = "suite-admin@adagiotalent.mx", "suite-owned-password"
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO app_user (name, email, password_hash, role)
            VALUES ('Suite Admin', %s, %s, 'admin')
            ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
            """,
            (email, application.hash_password(password)),
        )
    return email, password


@unittest.skipUnless(TEST_DB, "set ADAGIO_TEST_DATABASE_URL to run")
class BackofficeJourney(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import app as application
        cls.app = application
        cls.client = application.app.test_client()
        cls.admin_email, cls.admin_password = ensure_test_admin(application)

    def _auth(self, token):
        return {"Authorization": f"Bearer {token}"}

    def _login(self, email, password):
        res = self.client.post("/api/auth/login", json={"email": email, "password": password})
        self.assertEqual(res.status_code, 200, res.get_json())
        return res.json["token"]

    def test_full_journey(self):
        admin_token = self._login(self.admin_email, self.admin_password)
        admin_auth = self._auth(admin_token)

        # A company, then a job under it.
        company = self.client.post("/api/companies", headers=admin_auth,
                                    json={"name": "Acme Testing Co", "industry": "QA"})
        self.assertEqual(company.status_code, 201, company.get_json())
        company_id = company.json["id"]

        job = self.client.post("/api/jobs", headers=admin_auth, json={
            "title": "QA Engineer", "company_id": company_id,
            "responsibilities": ["Write tests", "Break things"],
            "tags": ["qa", "remote"],
        })
        self.assertEqual(job.status_code, 201, job.get_json())
        job_id = job.json["id"]

        # A draft job is invisible on the public board.
        public_before = self.client.get("/api/public/jobs")
        self.assertNotIn(job.json["slug"], [i["slug"] for i in public_before.json["items"]])

        # Publishing follows the status workflow.
        bad_transition = self.client.post(f"/api/jobs/{job_id}/status", headers=admin_auth,
                                          json={"status": "archived"})
        self.assertEqual(bad_transition.status_code, 409)

        published = self.client.post(f"/api/jobs/{job_id}/status", headers=admin_auth,
                                     json={"status": "published"})
        self.assertEqual(published.status_code, 200)

        public_after = self.client.get("/api/public/jobs")
        slugs = [i["slug"] for i in public_after.json["items"]]
        self.assertIn(job.json["slug"], slugs)

        detail = self.client.get(f"/api/public/jobs/{job.json['slug']}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json["responsibilities"], ["Write tests", "Break things"])

        # Duplicate creates a fresh draft.
        dup = self.client.post(f"/api/jobs/{job_id}/duplicate", headers=admin_auth)
        self.assertEqual(dup.status_code, 201)
        dup_detail = self.client.get(f"/api/jobs/{dup.json['id']}", headers=admin_auth)
        self.assertEqual(dup_detail.json["status"], "draft")

        # A recruiter account is admin-created, and cannot reach admin routes.
        recruiter = self.client.post("/api/users", headers=admin_auth, json={
            "name": "Rita Recruiter", "email": "rita@adagiotalent.mx",
            "password": "recruiterpass1", "role": "recruiter",
        })
        self.assertEqual(recruiter.status_code, 201, recruiter.get_json())
        recruiter_token = self._login("rita@adagiotalent.mx", "recruiterpass1")
        recruiter_auth = self._auth(recruiter_token)

        forbidden = self.client.get("/api/users", headers=recruiter_auth)
        self.assertEqual(forbidden.status_code, 403)

        forbidden_delete = self.client.delete(f"/api/jobs/{job_id}", headers=recruiter_auth)
        self.assertEqual(forbidden_delete.status_code, 403)

        # A recruiter can still do ordinary work: create a job.
        recruiter_job = self.client.post("/api/jobs", headers=recruiter_auth,
                                         json={"title": "Sales Rep", "company_id": company_id})
        self.assertEqual(recruiter_job.status_code, 201)

        # Stats and the audit trail reflect everything above.
        stats = self.client.get("/api/stats", headers=admin_auth)
        self.assertGreaterEqual(stats.json["total_jobs"], 2)
        self.assertGreaterEqual(stats.json["published"], 1)

        audit = self.client.get("/api/audit", headers=admin_auth)
        actions = [row["action"] for row in audit.json]
        self.assertIn("CREATE_JOB", actions)
        self.assertIn("STATUS_PUBLISHED", actions)
        self.assertIn("CREATE_USER", actions)

        audit_forbidden = self.client.get("/api/audit", headers=recruiter_auth)
        self.assertEqual(audit_forbidden.status_code, 403)

        # A company with a published job cannot be deleted.
        blocked = self.client.delete(f"/api/companies/{company_id}", headers=admin_auth)
        self.assertEqual(blocked.status_code, 409)

        # Closing then archiving frees it up for admin deletion of the job.
        self.client.post(f"/api/jobs/{job_id}/status", headers=admin_auth, json={"status": "closed"})
        deleted = self.client.delete(f"/api/jobs/{job_id}", headers=admin_auth)
        self.assertEqual(deleted.status_code, 200)

    def test_login_rejects_bad_credentials(self):
        res = self.client.post("/api/auth/login",
                               json={"email": self.admin_email, "password": "wrong"})
        self.assertEqual(res.status_code, 401)

    def test_unauthenticated_requests_are_rejected(self):
        res = self.client.get("/api/jobs")
        self.assertEqual(res.status_code, 401)


if __name__ == "__main__":
    unittest.main()
