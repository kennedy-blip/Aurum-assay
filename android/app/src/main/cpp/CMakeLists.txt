cmake_minimum_required(VERSION 3.22.1)
project(aurum-assay-native)

add_library(aurum-assay SHARED native-assay.cpp)

find_library(log-lib log)
target_link_libraries(aurum-assay ${log-lib})

target_compile_features(aurum-assay PRIVATE cxx_std_20)
