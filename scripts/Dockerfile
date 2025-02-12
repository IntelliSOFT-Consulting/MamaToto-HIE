# Use an official Python image as the base
FROM python:3.11

# Set the working directory inside the container
WORKDIR /app

# Copy the Python script and requirements file
COPY . .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Run the Python script
CMD ["python", "rebuild.py"]
