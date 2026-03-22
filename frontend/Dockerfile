FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG API_URL=http://backend:3000
ENV API_URL=${API_URL}

RUN npm run build

EXPOSE 3001

CMD ["npm", "run", "start", "--", "--port", "3001"]
