# Build the browser bundle with locked dependencies.
FROM node:24-alpine AS build

ENV NPM_CONFIG_LOGLEVEL=warn
ENV NPM_CONFIG_COLOR=false
WORKDIR /app
COPY package*.json /app/
RUN npm ci

# Parcel embeds these public settings in the static bundle.
ARG API_URL
ARG AWS_COGNITO_POOL_ID
ARG AWS_COGNITO_CLIENT_ID
ARG OAUTH_SIGN_IN_REDIRECT_URL

ENV API_URL=${API_URL}
ENV AWS_COGNITO_POOL_ID=${AWS_COGNITO_POOL_ID}
ENV AWS_COGNITO_CLIENT_ID=${AWS_COGNITO_CLIENT_ID}
ENV OAUTH_SIGN_IN_REDIRECT_URL=${OAUTH_SIGN_IN_REDIRECT_URL}

COPY index.html ./
COPY ./src ./src
RUN npm run build

FROM nginx:alpine AS production

LABEL maintainer="Harsh Prajapati"
LABEL description="Browser client for the Fragments cloud microservice"

COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
