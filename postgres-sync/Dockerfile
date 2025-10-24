FROM alpine:latest

# Install required tools: postgresql-client, curl, cron
RUN apk add --no-cache postgresql-client curl bash busybox-suid

# Create working directory
WORKDIR /app

# Copy files into the image
COPY sync-to-pg.sh /app/sync-to-pg.sh
COPY crontab.txt /app/crontab.txt

# Make script executable
RUN chmod +x /app/sync-to-pg.sh

# Setup crontab
RUN crontab /app/crontab.txt

# Create a log file cron can write to
RUN touch /var/log/cron.log

# Start cron and keep container running
CMD ["sh", "-c", "crond -f -l 2 && tail -f /var/log/cron.log"]
