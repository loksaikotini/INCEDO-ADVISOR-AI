@echo off
REM generate_protos.bat

python -m grpc_tools.protoc -I./proto --python_out=./proto --grpc_python_out=./proto ./proto/ner.proto
echo Protobuf files generated in proto/
