FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/noteblock-api ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/noteblock-api /noteblock-api
EXPOSE 4000
USER nonroot:nonroot
ENTRYPOINT ["/noteblock-api"]
