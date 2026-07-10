FROM python:3.12-slim

# build-essential: required for cmdstanpy's Stan model compile step, which
# Prophet triggers on first fit (and again at container build time below, so
# the compiled Stan binary is baked into the image rather than compiled on
# every cold start).
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Warm/verify the cmdstan install Prophet needs at import time — surfaces a
# broken Stan toolchain at build time instead of on the first real request.
RUN python -c "import cmdstanpy; cmdstanpy.install_cmdstan()" || true

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
