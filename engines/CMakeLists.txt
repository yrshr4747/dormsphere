cmake_minimum_required(VERSION 3.16)
project(DormSphereEngines VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find OpenSSL for SHA-256
find_package(OpenSSL REQUIRED)

include_directories(${CMAKE_SOURCE_DIR}/include)

# --- Gale-Shapley Matching Engine ---
add_executable(gale_shapley src/gale_shapley.cpp)

# --- Provably Fair Lottery Engine ---
add_executable(lottery_engine src/lottery_engine.cpp)
target_link_libraries(lottery_engine OpenSSL::Crypto)

# --- Atomic Conflict Resolver ---
add_executable(conflict_resolver src/conflict_resolver.cpp)
target_link_libraries(conflict_resolver pthread)

# --- Benchmark ---
add_executable(resolver_bench ../tests/resolver_bench.cpp)
target_link_libraries(resolver_bench pthread)
