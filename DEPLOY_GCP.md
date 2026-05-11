# Deploy Django to Google Cloud Run + Cloud SQL PostgreSQL

This project is now prepared for production deployment on Google Cloud Platform with:

- Cloud Run for the Django web service
- Cloud SQL PostgreSQL for persistent data
- Secret Manager for sensitive settings
- WhiteNoise for static files inside the container
- optional Cloudinary-backed media storage for uploaded files

This setup fixes the class of issue you saw on Render: user signups and other records are only durable when the app uses a persistent production database such as Cloud SQL, not local SQLite inside ephemeral containers.

---

## 1. What is already configured in the codebase

The project now supports:

- `DEBUG` from environment variables
- `SECRET_KEY` from environment variables
- `ALLOWED_HOSTS` from environment variables
- `CSRF_TRUSTED_ORIGINS` from environment variables
- PostgreSQL via `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`
- optional `DATABASE_URL`
- local SQLite only when `USE_SQLITE=True`
- production-safe static file collection to `staticfiles/`
- Docker-based deployment with Gunicorn

Main files:

- `manage.py`
- `gita_site/settings.py`
- `gita_site/wsgi.py`
- `requirements.txt`
- `Dockerfile`
- `.dockerignore`
- `.env.example`

---

## 2. Required Google Cloud services

Enable these APIs in your GCP project:

- Cloud Run API
- Cloud Build API
- Artifact Registry API
- Cloud SQL Admin API
- Secret Manager API

Command:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com
```

---

## 3. Set your shell variables

Replace these with your real values before running commands:

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="asia-south1"
export SERVICE_NAME="sciencemeetsanatan"
export REPOSITORY="sms-containers"
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:latest"

export INSTANCE_NAME="sms-postgres"
export DB_NAME="sciencemeetsanatan"
export DB_USER="sms_app_user"
export DB_PASSWORD="change-this-password"
export INSTANCE_CONNECTION_NAME="${PROJECT_ID}:${REGION}:${INSTANCE_NAME}"

export DJANGO_SUPERUSER_USERNAME="admin"
export DJANGO_SUPERUSER_EMAIL="admin@example.com"
export DJANGO_SUPERUSER_PASSWORD="change-this-superuser-password"
```

Set the project:

```bash
gcloud config set project "${PROJECT_ID}"
```

---

## 4. Create Artifact Registry repository

```bash
gcloud artifacts repositories create "${REPOSITORY}" \
  --repository-format=docker \
  --location="${REGION}"
```

If it already exists, skip this step.

---

## 5. Create Cloud SQL PostgreSQL

Create the PostgreSQL instance:

```bash
gcloud sql instances create "${INSTANCE_NAME}" \
  --database-version=POSTGRES_16 \
  --tier=db-custom-1-3840 \
  --region="${REGION}"
```

Create the database:

```bash
gcloud sql databases create "${DB_NAME}" \
  --instance="${INSTANCE_NAME}"
```

Create the application user:

```bash
gcloud sql users create "${DB_USER}" \
  --instance="${INSTANCE_NAME}" \
  --password="${DB_PASSWORD}"
```

Get the instance connection name if needed:

```bash
gcloud sql instances describe "${INSTANCE_NAME}" \
  --format="value(connectionName)"
```

---

## 6. Create Secret Manager secrets

Create the required secrets:

```bash
printf '%s' 'your-production-secret-key' | gcloud secrets create django-secret-key --data-file=-
printf '%s' 'False' | gcloud secrets create django-debug --data-file=-
printf '%s' 'your-cloud-run-domain,custom-domain-if-any' | gcloud secrets create django-allowed-hosts --data-file=-
printf '%s' 'https://your-cloud-run-domain,https://your-custom-domain' | gcloud secrets create django-csrf-trusted-origins --data-file=-

printf '%s' "${DB_NAME}" | gcloud secrets create django-db-name --data-file=-
printf '%s' "${DB_USER}" | gcloud secrets create django-db-user --data-file=-
printf '%s' "${DB_PASSWORD}" | gcloud secrets create django-db-password --data-file=-
printf '%s' "/cloudsql/${INSTANCE_CONNECTION_NAME}" | gcloud secrets create django-db-host --data-file=-
printf '%s' '5432' | gcloud secrets create django-db-port --data-file=-

printf '%s' 'False' | gcloud secrets create django-use-sqlite --data-file=-

# Optional if used by your app:
printf '%s' 'your-openai-key' | gcloud secrets create openai-api-key --data-file=-
```

Optional superuser secret:

```bash
printf '%s' "${DJANGO_SUPERUSER_PASSWORD}" | gcloud secrets create django-superuser-password --data-file=-
```

---

## 7. Grant Secret Manager access to the Cloud Run service account

By default, Cloud Run often uses the Compute Engine default service account unless you assign a custom one.

Get the project number:

```bash
export PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
export RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
```

Grant secret access:

```bash
for SECRET in \
  django-secret-key \
  django-debug \
  django-allowed-hosts \
  django-csrf-trusted-origins \
  django-db-name \
  django-db-user \
  django-db-password \
  django-db-host \
  django-db-port \
  django-use-sqlite \
  openai-api-key \
  django-superuser-password
do
  gcloud secrets add-iam-policy-binding "${SECRET}" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" || true
done
```

If you use a custom Cloud Run service account, replace `RUNTIME_SA` with that service account email.

---

## 8. Build the container image

From the project root:

```bash
gcloud builds submit --tag "${IMAGE}"
```

---

## 9. Deploy to Cloud Run

Deploy the web service:

```bash
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --add-cloudsql-instances="${INSTANCE_CONNECTION_NAME}" \
  --set-env-vars="USE_SQLITE=False,INSTANCE_CONNECTION_NAME=${INSTANCE_CONNECTION_NAME},SECURE_SSL_REDIRECT=True,SESSION_COOKIE_SECURE=True,CSRF_COOKIE_SECURE=True" \
  --set-secrets="SECRET_KEY=django-secret-key:latest,DEBUG=django-debug:latest,ALLOWED_HOSTS=django-allowed-hosts:latest,CSRF_TRUSTED_ORIGINS=django-csrf-trusted-origins:latest,DB_NAME=django-db-name:latest,DB_USER=django-db-user:latest,DB_PASSWORD=django-db-password:latest,DB_HOST=django-db-host:latest,DB_PORT=django-db-port:latest,OPENAI_API_KEY=openai-api-key:latest"
```

Notes:

- `DB_HOST` is set to `/cloudsql/PROJECT:REGION:INSTANCE`, which matches the Unix socket mount path used by Cloud Run.
- `USE_SQLITE=False` ensures production never falls back to SQLite.
- `ALLOWED_HOSTS` should include your Cloud Run URL and any custom domain.
- `CSRF_TRUSTED_ORIGINS` must include full `https://` origins.

After deployment, get the service URL:

```bash
gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --format="value(status.url)"
```

Use that URL in `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` if you did not know it beforehand, then redeploy or update the service:

```bash
gcloud run services update "${SERVICE_NAME}" \
  --region="${REGION}" \
  --update-secrets="ALLOWED_HOSTS=django-allowed-hosts:latest,CSRF_TRUSTED_ORIGINS=django-csrf-trusted-origins:latest"
```

---

## 10. Run migrations in production

Do **not** rely on the web container startup to run migrations.
Run migrations through a Cloud Run job using the same image.

Create or update the migration job:

```bash
gcloud run jobs deploy "${SERVICE_NAME}-migrate" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --tasks=1 \
  --max-retries=1 \
  --task-timeout=15m \
  --set-cloudsql-instances="${INSTANCE_CONNECTION_NAME}" \
  --set-env-vars="USE_SQLITE=False,INSTANCE_CONNECTION_NAME=${INSTANCE_CONNECTION_NAME},SECURE_SSL_REDIRECT=True,SESSION_COOKIE_SECURE=True,CSRF_COOKIE_SECURE=True" \
  --set-secrets="SECRET_KEY=django-secret-key:latest,DEBUG=django-debug:latest,ALLOWED_HOSTS=django-allowed-hosts:latest,CSRF_TRUSTED_ORIGINS=django-csrf-trusted-origins:latest,DB_NAME=django-db-name:latest,DB_USER=django-db-user:latest,DB_PASSWORD=django-db-password:latest,DB_HOST=django-db-host:latest,DB_PORT=django-db-port:latest,OPENAI_API_KEY=openai-api-key:latest" \
  --command=python \
  --args=manage.py,migrate
```

Execute the migration job:

```bash
gcloud run jobs execute "${SERVICE_NAME}-migrate" \
  --region="${REGION}" \
  --wait
```

Equivalent Django command:

```bash
python manage.py migrate
```

---

## 11. Create the Django superuser safely

Preferred non-interactive production method:

```bash
gcloud run jobs deploy "${SERVICE_NAME}-createsuperuser" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --tasks=1 \
  --max-retries=1 \
  --task-timeout=15m \
  --set-cloudsql-instances="${INSTANCE_CONNECTION_NAME}" \
  --set-env-vars="USE_SQLITE=False,INSTANCE_CONNECTION_NAME=${INSTANCE_CONNECTION_NAME},DJANGO_SUPERUSER_USERNAME=${DJANGO_SUPERUSER_USERNAME},DJANGO_SUPERUSER_EMAIL=${DJANGO_SUPERUSER_EMAIL}" \
  --set-secrets="SECRET_KEY=django-secret-key:latest,DEBUG=django-debug:latest,ALLOWED_HOSTS=django-allowed-hosts:latest,CSRF_TRUSTED_ORIGINS=django-csrf-trusted-origins:latest,DB_NAME=django-db-name:latest,DB_USER=django-db-user:latest,DB_PASSWORD=django-db-password:latest,DB_HOST=django-db-host:latest,DB_PORT=django-db-port:latest,DJANGO_SUPERUSER_PASSWORD=django-superuser-password:latest" \
  --command=python \
  --args=manage.py,createsuperuser,--noinput
```

Run it once:

```bash
gcloud run jobs execute "${SERVICE_NAME}-createsuperuser" \
  --region="${REGION}" \
  --wait
```

Equivalent Django command:

```bash
python manage.py createsuperuser
```

If you need an interactive shell for debugging:

```bash
python manage.py createsuperuser
```

Use that only locally or in a controlled admin environment.

---

## 12. Static files

Static files are handled inside the container with WhiteNoise.

The Docker image already runs:

```bash
python manage.py collectstatic --noinput
```

Equivalent manual command:

```bash
python manage.py collectstatic --noinput
```

You should verify after deployment that:

- `/static/...` assets load correctly
- CSS and JS work normally
- admin static assets load correctly

---

## 13. Media / uploaded files

Important:

- Cloud Run filesystem is ephemeral.
- Do **not** rely on local disk storage for uploaded media in production.

Current project behavior:

- local development keeps `MEDIA_ROOT=media`
- optional Cloudinary storage can be enabled with:
  - `CLOUDINARY_STORAGE_ENABLED=True`
  - `CLOUDINARY_URL=cloudinary://...`

If your app starts accepting user uploads in production, configure Cloudinary or Cloud Storage before launching that feature.

---

## 14. Local development still works

Example local `.env` for SQLite:

```env
SECRET_KEY=dev-secret
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
USE_SQLITE=True
```

Run locally:

```bash
python manage.py migrate
python manage.py runserver
```

If you want local PostgreSQL instead:

```env
DEBUG=True
USE_SQLITE=False
DB_NAME=your_local_db
DB_USER=your_local_user
DB_PASSWORD=your_local_password
DB_HOST=127.0.0.1
DB_PORT=5432
```

---

## 15. Production validation checklist

After deployment, verify these in order:

### App boot

- Cloud Run revision becomes healthy
- no startup errors in logs
- homepage loads

### Database persistence

- create a new user from the website
- log out
- log back in with the same credentials
- verify the user still exists
- verify records persist after a redeploy

### Admin

- visit `/admin/`
- log in with the superuser
- verify models are visible
- create/edit a test object

### Static files

- CSS loads
- JS loads
- images/icons load
- admin CSS loads

### Existing business logic

- signup works
- login works
- session persistence works
- saved records appear in PostgreSQL-backed flows
- app pages behave the same as local

---

## 16. Recommended post-deploy checks

Inspect Cloud Run logs:

```bash
gcloud run services logs read "${SERVICE_NAME}" \
  --region="${REGION}" \
  --limit=200
```

Inspect migration job logs:

```bash
gcloud run jobs executions list \
  --job="${SERVICE_NAME}-migrate" \
  --region="${REGION}"
```

Inspect Cloud SQL instance:

```bash
gcloud sql instances describe "${INSTANCE_NAME}"
```

---

## 17. Safety checklist

Before going live, confirm:

- `DEBUG=False`
- `SECRET_KEY` is only in Secret Manager
- `USE_SQLITE=False` in production
- production database is Cloud SQL PostgreSQL
- `ALLOWED_HOSTS` contains real production hosts
- `CSRF_TRUSTED_ORIGINS` contains full HTTPS origins
- `OPENAI_API_KEY` and other keys are in Secret Manager
- migrations ran successfully
- superuser exists
- signup/login has been tested on production
- static files load correctly
- admin works
- media strategy is decided before enabling uploads

---

## 18. Why this fixes the Render-style persistence issue

If Django runs on Cloud Run with SQLite in the container filesystem:

- each container instance has ephemeral storage
- data can disappear on restart or redeploy
- multiple instances cannot safely share that SQLite file

With Cloud SQL PostgreSQL:

- users are stored in a managed persistent database
- login/session-related database records persist correctly
- admin data and app data survive redeploys
- production behaves like a real multi-instance web app

