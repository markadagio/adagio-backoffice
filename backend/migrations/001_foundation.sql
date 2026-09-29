-- Foundation: users, companies, jobs, and the audit trail.
--
-- Jobs and companies are soft-deleted (deleted_at) rather than removed,
-- because the audit log keeps referring to them by id and a hard delete
-- would leave it pointing at nothing.

CREATE TABLE app_user (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    email      text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role       text NOT NULL CHECK (role IN ('admin', 'recruiter')),
    active     boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE company (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name           text NOT NULL,
    slug           text NOT NULL UNIQUE,
    industry       text,
    website        text,
    logo_url       text,
    description    text,
    contact_person text,
    contact_email  text,
    contact_phone  text,
    notes          text,
    active         boolean NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    deleted_at     timestamptz
);

CREATE TABLE job (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                     text NOT NULL UNIQUE,
    title                    text NOT NULL,
    company_id               uuid NOT NULL REFERENCES company (id),
    department               text,
    location                 text,
    country                  text NOT NULL DEFAULT 'México',
    work_arrangement         text NOT NULL DEFAULT 'on-site'
                             CHECK (work_arrangement IN ('remote', 'hybrid', 'on-site')),
    employment_type          text NOT NULL DEFAULT 'full-time'
                             CHECK (employment_type IN ('full-time', 'part-time', 'contract')),
    short_description        text,
    description              text,
    responsibilities         text[] NOT NULL DEFAULT '{}',
    requirements             text[] NOT NULL DEFAULT '{}',
    preferred_qualifications text[] NOT NULL DEFAULT '{}',
    benefits                 text[] NOT NULL DEFAULT '{}',
    tags                     text[] NOT NULL DEFAULT '{}',
    application_url          text,
    status                   text NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft', 'published', 'paused', 'closed', 'archived')),
    published_at             timestamptz,
    created_by               uuid REFERENCES app_user (id),
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    deleted_at                timestamptz
);

CREATE INDEX job_status_idx     ON job (status) WHERE deleted_at IS NULL;
CREATE INDEX job_company_idx    ON job (company_id) WHERE deleted_at IS NULL;
CREATE INDEX job_updated_idx    ON job (updated_at DESC);

-- Append-only. What happened, who did it, and to what.
CREATE TABLE audit_log (
    id          bigserial PRIMARY KEY,
    user_id     uuid REFERENCES app_user (id),
    user_name   text,
    action      text NOT NULL,
    entity_type text NOT NULL,
    entity_id   text,
    entity_name text,
    details     jsonb,
    ip          text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_entity_idx   ON audit_log (entity_type, entity_id);
CREATE INDEX audit_log_created_idx  ON audit_log (created_at DESC);
