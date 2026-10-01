# Môi trường local bằng Docker

Image chứa Java 11, Maven 3.9.11, Python 3 và project đã build. Hadoop chạy bằng LocalJobRunner trong một container; đây không phải cụm HDFS/YARN. Java/Maven không cần cài trên host. Cần Docker Engine/Desktop và Docker Compose plugin; build cần Internet để tải base image, apt packages và Maven dependencies.

## Build và demo

```bash
mkdir -p data/raw data/samples results
docker compose build
docker compose run --rm bigdata
```

Demo chạy preflight/profile, năm variants, so output với V1 và export CSV. Kết quả nằm `results/docker-demo` trên host. Output phải mới; lần chạy sau chọn đường dẫn khác:

```bash
docker compose run --rm bigdata bash scripts/demo.sh results/docker-demo-02
```

Source/config/scripts nằm trong image; sửa chúng thì build lại. Chỉ data và results được bind-mount. Không đưa dataset Kaggle, cache, tools hay results host vào build context.

## Kiểm thử

```bash
docker compose run --rm bigdata ./mvnw -B -Pintegration verify
docker compose run --rm bigdata python3 -m unittest discover -s scripts -p 'test_*.py'
```

Image build compile/package; hai lệnh trên chạy test. Không ép platform amd64 để image có thể chạy theo architecture host nếu base image hỗ trợ.

## Dữ liệu và benchmark

Chuẩn bị synthetic workload và metadata, dùng các thư mục output chưa tồn tại:

```bash
docker compose run --rm bigdata python3 scripts/generate_workload.py --output data/samples/optimization-200k.csv --rows 200000 --groups 32 --purchase-rate 1 --seed 21
docker compose run --rm bigdata scripts/prepare-input.sh data/samples/optimization-200k.csv results/optimization-meta
docker compose run --rm bigdata scripts/run-local.sh --tool DatasetTool profile --manifest results/optimization-meta/input.json --output results/optimization-meta/profile.json --dictionary results/optimization-meta/groups.json
docker compose run --rm bigdata python3 scripts/benchmark.py --matrix config/benchmark-matrix.json
```

CSV thật đặt dưới data/raw trên host rồi dùng cùng CLI với đường dẫn tương đối `data/raw/...`. Manifest tạo bên host bằng đường dẫn tuyệt đối không thể dùng nguyên trạng bên container: tạo preflight/profile trong container để giữ URI chính xác.

## Chạy CLI hoặc shell

```bash
docker compose run --rm bigdata scripts/run-local.sh --variant v3 --manifest results/optimization-meta/input.json --preflight results/optimization-meta/preflight.json --output results/docker-v3 --group-by category_id --reducers 2 --max-keys 10000
docker compose run --rm bigdata bash
```

Không dùng Compose cũng được:

```bash
docker build -t ptit-bigdata:local .
docker run --rm -v "$PWD/data:/opt/bigdata/data" -v "$PWD/results:/opt/bigdata/results" ptit-bigdata:local
```

## Phạm vi kiểm chứng

Host hiện tại chưa có Docker CLI/daemon, nên Docker image chưa được build/run tại đây. Build và integration tests Java trên host đã được kiểm tra; cần chạy các lệnh Docker trên máy có Docker để kiểm chứng container. Benchmark hiện có được đo trên host, không phải container.
