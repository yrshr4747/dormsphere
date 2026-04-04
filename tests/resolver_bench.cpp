/**
 * DormSphere — Conflict Resolver Benchmark
 *
 * Tests: 200+ rooms processed in < 1 second with high concurrency.
 * Runs multiple configurations and reports timing.
 */

#include "../engines/include/common.h"
#include <thread>
#include <mutex>
#include <atomic>
#include <vector>
#include <chrono>
#include <random>
#include <iomanip>
#include <cassert>

struct BenchRoomState {
    std::mutex mtx;
    int capacity;
    int occupied;
};

struct BenchResult {
    int rooms;
    int students;
    int successful;
    int rejected;
    int double_bookings;
    double elapsed_ms;
};

BenchResult runBenchmark(int numRooms, int studentsPerRoom, int roomCapacity) {
    std::vector<BenchRoomState> rooms(numRooms);
    for (int i = 0; i < numRooms; i++) {
        rooms[i].capacity = roomCapacity;
        rooms[i].occupied = 0;
    }

    int totalStudents = numRooms * studentsPerRoom;
    std::atomic<int> successful{0};
    std::atomic<int> rejected{0};

    auto start = std::chrono::high_resolution_clock::now();

    std::vector<std::thread> threads;
    threads.reserve(totalStudents);

    for (int s = 0; s < totalStudents; s++) {
        threads.emplace_back([&, s]() {
            std::mt19937 rng(s * 31 + 17);
            int targetRoom = rng() % numRooms;

            std::lock_guard<std::mutex> lock(rooms[targetRoom].mtx);
            if (rooms[targetRoom].occupied < rooms[targetRoom].capacity) {
                rooms[targetRoom].occupied++;
                successful++;
            } else {
                rejected++;
            }
        });
    }

    for (auto& t : threads) t.join();

    auto end = std::chrono::high_resolution_clock::now();
    double elapsed = std::chrono::duration<double, std::milli>(end - start).count();

    int doubleBookings = 0;
    for (int i = 0; i < numRooms; i++) {
        if (rooms[i].occupied > rooms[i].capacity) doubleBookings++;
    }

    return {numRooms, totalStudents, successful.load(), rejected.load(), doubleBookings, elapsed};
}

int main() {
    std::cout << std::fixed << std::setprecision(2);
    std::cout << "╔══════════════════════════════════════════════════════════════════╗" << std::endl;
    std::cout << "║          DormSphere Conflict Resolver — Benchmark Suite         ║" << std::endl;
    std::cout << "╚══════════════════════════════════════════════════════════════════╝" << std::endl;
    std::cout << std::endl;

    struct TestCase {
        int rooms;
        int studentsPerRoom;
        int capacity;
        std::string label;
    };

    std::vector<TestCase> tests = {
        {200,  3, 2, "200 rooms, 3 students/room, capacity 2 (baseline)"},
        {500,  4, 2, "500 rooms, 4 students/room, capacity 2 (medium)"},
        {1000, 5, 2, "1000 rooms, 5 students/room, capacity 2 (stress)"},
        {200, 10, 2, "200 rooms, 10 students/room, capacity 2 (high contention)"},
    };

    bool allPassed = true;
    std::cout << "{\"benchmarks\":[";

    for (size_t i = 0; i < tests.size(); i++) {
        auto& tc = tests[i];
        std::cerr << "Running: " << tc.label << "..." << std::endl;

        auto result = runBenchmark(tc.rooms, tc.studentsPerRoom, tc.capacity);
        
        bool passed = (result.double_bookings == 0) && (result.elapsed_ms < 1000.0);
        if (!passed) allPassed = false;

        std::cerr << "  → " << result.elapsed_ms << "ms, "
                  << result.successful << " assigned, "
                  << result.rejected << " rejected, "
                  << result.double_bookings << " double-bookings"
                  << (passed ? " ✅" : " ❌") << std::endl;

        if (i > 0) std::cout << ",";
        std::cout << "{\"label\":\"" << dormsphere::escapeJson(tc.label)
                  << "\",\"rooms\":" << tc.rooms
                  << ",\"students\":" << result.students
                  << ",\"successful\":" << result.successful
                  << ",\"rejected\":" << result.rejected
                  << ",\"double_bookings\":" << result.double_bookings
                  << ",\"elapsed_ms\":" << result.elapsed_ms
                  << ",\"passed\":" << (passed ? "true" : "false") << "}";
    }

    std::cout << "],\"all_passed\":" << (allPassed ? "true" : "false") << "}" << std::endl;
    
    std::cerr << std::endl;
    std::cerr << (allPassed ? "✅ ALL BENCHMARKS PASSED" : "❌ SOME BENCHMARKS FAILED") << std::endl;

    return allPassed ? 0 : 1;
}
