FROM node:12-alpine
RUN apk add --no-cache make gcc g++ python git
COPY package.json package.json
COPY yarn.lock yarn.lock
RUN yarn add scrypt
RUN yarn
#RUN yarn global add @openzeppelin/cli
COPY . .
RUN npx oz compile --no-interactive
RUN ./deploy
