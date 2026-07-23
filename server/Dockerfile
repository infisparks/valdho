# Dockerfile for Coolify Deployment
FROM node:20-alpine

WORKDIR /app

# Copy package files & install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy server code
COPY . .

# Expose server port
EXPOSE 5001

# Start command
CMD ["npm", "start"]
