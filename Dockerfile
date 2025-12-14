# Use an official lightweight Node.js image as a parent image
FROM node:23.6.0-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install any needed packages specified in package.json
RUN npm install

# Bundle the source code inside the Docker image
COPY . .

# Needed folder to run the app and set proper permissions
RUN mkdir -p /nonexistent && \
    chown -R nobody:nogroup /nonexistent /usr/src/app

# Create a non-root user to run the app
USER nobody


# The application will listen on port 8080, so expose it
EXPOSE 8080


# Define the command to run the app
CMD [ "npm", "start" ]
