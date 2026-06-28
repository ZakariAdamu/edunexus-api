FROM node:24.18.0

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN npm install -g pnpm@11.5.1

RUN HUSKY=0 pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

EXPOSE 5000

CMD ["node", "dist/server.js"]
