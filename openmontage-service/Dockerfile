# OpenMontage sidecar — python + node + ffmpeg
FROM python:3.11-slim

# ffmpeg + node 18 (requisitos de OpenMontage) + git para clonar
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg git curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

# OpenMontage se clona en build (NUNCA se vendoriza en el repo de Boostify)
ARG OPENMONTAGE_REF=main
RUN git clone --depth 1 --branch ${OPENMONTAGE_REF} \
      https://github.com/calesthio/OpenMontage.git /srv/openmontage \
    && pip install --no-cache-dir -r /srv/openmontage/requirements.txt

COPY requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt

COPY app.py /srv/app.py

ENV OM_ROOT=/srv/openmontage \
    PYTHONPATH=/srv/openmontage \
    PORT=8080

EXPOSE 8080
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
