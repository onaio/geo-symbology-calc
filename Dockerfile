FROM node:22.23.4-alpine as build

RUN corepack enable

RUN apk add --no-cache libc6-compat

COPY ./ /repo 

WORKDIR /repo

ENV NODE_CONFIG_DIR=/repo/apps/web/config

RUN yarn install

RUN yarn build

RUN yarn workspaces focus -A --production

FROM node:22.23.4-alpine

COPY --from=build /repo /usr/src/symbology

WORKDIR /usr/src/symbology

ENV NODE_CONFIG_DIR=/usr/src/symbology/apps/web/config

# Use tini for NodeJS application https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#handling-kernel-signals
RUN apk add --no-cache tini curl

EXPOSE 3000

CMD ["node", "/usr/src/symbology/apps/web/build"]

ENTRYPOINT ["/sbin/tini", "--"]
