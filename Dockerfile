FROM maven:3.9.11-eclipse-temurin-11

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/bigdata
COPY pom.xml mvnw ./
RUN chmod +x mvnw && ./mvnw -B dependency:go-offline

COPY src ./src
COPY scripts ./scripts
COPY config ./config
RUN chmod +x scripts/*.sh \
    && ./mvnw -B -DskipTests package dependency:build-classpath \
       -DincludeScope=compile -Dmdep.outputFile=.build-cache/classpath.txt \
    && mkdir -p data/raw data/samples results

CMD ["bash", "scripts/demo.sh", "results/docker-demo"]
