cmake_minimum_required(VERSION 3.16)
project(DormSphereEngines VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find OpenSSL for SHA-256 (used in Lottery Engine)
find_package(OpenSSL REQUIRED)

# Include the headers from your include folder
include_directories(${CMAKE_SOURCE_DIR}/include)

# --- Gale-Shapley Matching Engine ---
add_executable(gale_shapley src/gale_shapley.cpp)

# --- Provably Fair Lottery Engine ---
add_executable(lottery_engine src/lottery_engine.cpp)
target_link_libraries(lottery_engine OpenSSL::Crypto)

# --- Atomic Conflict Resolver ---
# Linked with pthread for the mutex logic we discussed
add_executable(conflict_resolver src/conflict_resolver.cpp)
target_link_libraries(conflict_resolver pthread)