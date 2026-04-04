/**
 * DormSphere — Atomic Conflict Resolver
 *
 * Simulates high-concurrency room selection with mutex-based atomic locking.
 * Each room has its own mutex; multiple threads compete to book rooms simultaneously.
 *
 * Input (stdin JSON):
 * {
 *   "rooms": 200,
 *   "students_per_room": 3,
 *   "room_capacity": 2
 * }
 *
 * Output (stdout JSON):
 * {
 *   "total_rooms": 200,
 *   "total_attempts": 600,
 *   "successful": 400,
 *   "rejected": 200,
 *   "double_bookings": 0,
 *   "elapsed_ms": 45.2,
 *   "decisions": [...]
 * }
 */

#include "common.h"
#include <thread>
#include <mutex>
#include <atomic>
#include <vector>
#include <chrono>
#include <random>
#include <iomanip>

using namespace dormsphere;

struct RoomState {
    std::mutex mtx;
    int capacity;
    int occupied;
    std::vector<std::string> assignedStudents;
};

struct Decision {
    std::string student_id;
    std::string room_id;
    bool success;
    std::string reason;
};

int main() {
    // ---- Read Input ----
    std::string input = readStdin();
    
    int numRooms = static_cast<int>(jsonGetNumber(input, "rooms"));
    int studentsPerRoom = static_cast<int>(jsonGetNumber(input, "students_per_room"));
    int roomCapacity = static_cast<int>(jsonGetNumber(input, "room_capacity"));

    if (numRooms <= 0) numRooms = 200;
    if (studentsPerRoom <= 0) studentsPerRoom = 3;
    if (roomCapacity <= 0) roomCapacity = 2;

    // ---- Initialize Rooms ----
    std::vector<RoomState> rooms(numRooms);
    for (int i = 0; i < numRooms; i++) {
        rooms[i].capacity = roomCapacity;
        rooms[i].occupied = 0;
    }

    // ---- Prepare Attempts ----
    int totalStudents = numRooms * studentsPerRoom;
    std::vector<Decision> allDecisions(totalStudents);
    std::atomic<int> successful{0};
    std::atomic<int> rejected{0};

    // ---- Concurrent Selection ----
    auto startTime = std::chrono::high_resolution_clock::now();

    std::vector<std::thread> threads;
    threads.reserve(totalStudents);

    for (int s = 0; s < totalStudents; s++) {
        threads.emplace_back([&, s]() {
            // Each student picks a random room (simulating conflicting selections)
            std::mt19937 rng(s * 31 + 17);
            int targetRoom = rng() % numRooms;
            
            std::string studentId = "STU-" + std::to_string(s + 1);
            std::string roomId = "ROOM-" + std::to_string(targetRoom + 1);

            Decision d;
            d.student_id = studentId;
            d.room_id = roomId;

            // Atomic lock on the specific room (simulates SELECT FOR UPDATE)
            {
                std::lock_guard<std::mutex> lock(rooms[targetRoom].mtx);
                
                if (rooms[targetRoom].occupied < rooms[targetRoom].capacity) {
                    rooms[targetRoom].occupied++;
                    rooms[targetRoom].assignedStudents.push_back(studentId);
                    d.success = true;
                    d.reason = "assigned";
                    successful++;
                } else {
                    d.success = false;
                    d.reason = "room_full";
                    rejected++;
                }
            }

            allDecisions[s] = d;
        });
    }

    for (auto& t : threads) {
        t.join();
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    double elapsedMs = std::chrono::duration<double, std::milli>(endTime - startTime).count();

    // ---- Verify No Double Bookings ----
    int doubleBookings = 0;
    for (int i = 0; i < numRooms; i++) {
        if (rooms[i].occupied > rooms[i].capacity) {
            doubleBookings++;
        }
    }

    // ---- Output JSON ----
    std::cout << std::fixed << std::setprecision(1);
    std::cout << "{\"total_rooms\":" << numRooms
              << ",\"total_attempts\":" << totalStudents
              << ",\"successful\":" << successful.load()
              << ",\"rejected\":" << rejected.load()
              << ",\"double_bookings\":" << doubleBookings
              << ",\"elapsed_ms\":" << elapsedMs
              << ",\"decisions\":[";

    // Output first 20 decisions as sample
    int limit = std::min(20, totalStudents);
    for (int i = 0; i < limit; i++) {
        if (i > 0) std::cout << ",";
        std::cout << "{\"student_id\":\"" << escapeJson(allDecisions[i].student_id)
                  << "\",\"room_id\":\"" << escapeJson(allDecisions[i].room_id)
                  << "\",\"success\":" << (allDecisions[i].success ? "true" : "false")
                  << ",\"reason\":\"" << escapeJson(allDecisions[i].reason) << "\"}";
    }
    std::cout << "]}" << std::endl;

    return 0;
}
