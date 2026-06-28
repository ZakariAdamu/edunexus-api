FROM node:24.18.0

WORKDIR /app

COPY package*.json ./

RUN pnpm install

COPY . .

RUN pnpm build

EXPOSE 5000

CMD ["pnpm", "start"]