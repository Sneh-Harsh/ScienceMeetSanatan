FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080 \
    DEBUG=True \
    DJANGO_STATICFILES_STORAGE=whitenoise.storage.CompressedManifestStaticFilesStorage

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY . /app/

RUN python manage.py collectstatic --noinput

EXPOSE 8080

CMD ["sh", "-c", "exec gunicorn gita_site.wsgi:application --bind 0.0.0.0:${PORT:-8080} --workers ${GUNICORN_WORKERS:-2} --threads ${GUNICORN_THREADS:-4} --timeout ${GUNICORN_TIMEOUT:-120}"]
