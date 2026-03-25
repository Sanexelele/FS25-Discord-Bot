FROM node:latest
LABEL name="LS25-Discord-Bot"
LABEL authors="Dennis Heinrich"

# Copy the source files
WORKDIR /app
COPY . /app
RUN npm install pnpm -g
RUN pnpm install
RUN pnpm run build

## Simplyfy the rm commands
RUN rm -rf .ddev/ source/ misc/ .git .gitignore config.example-de.json config.example-en.json Dockerfile docker-compose.yml README.md

CMD ["npm", "run", "start-only"]
ENTRYPOINT ["npm", "run", "start-only"]