FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

EXPOSE 3001

# Run migrations then start
CMD ["sh", "-c", "node src/db/migrate.js && node src/index.js"]
