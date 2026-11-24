FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x /app/startup.sh

# Run as a non-root user.
RUN groupadd --system app && useradd --system --gid app --home-dir /app app && chown -R app:app /app
USER app

ENV PORT=8000
EXPOSE 8000
CMD ["/app/startup.sh"]
