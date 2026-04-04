/**
 * DormSphere — Provably Fair Lottery Engine
 *
 * Uses SHA-256 to generate deterministic, auditable rankings.
 * rank = SHA256(student_id + global_seed)
 * Lexicographic sort of hex hashes determines selection order.
 *
 * Input (stdin JSON):
 * {
 *   "students": ["s1", "s2", "s3", ...],
 *   "seed": "public-seed-2026-spring"
 * }
 *
 * Output (stdout JSON):
 * {
 *   "seed": "public-seed-2026-spring",
 *   "rankings": [
 *     {"student_id":"s3","hash":"0a1b...","rank":1},
 *     {"student_id":"s1","hash":"3c4d...","rank":2},
 *     ...
 *   ]
 * }
 */

#include "common.h"
#include <openssl/sha.h>
#include <algorithm>
#include <iomanip>

using namespace dormsphere;

struct RankEntry {
    std::string student_id;
    std::string hash;
    int rank;
};

std::string sha256(const std::string& input) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256(reinterpret_cast<const unsigned char*>(input.c_str()), input.size(), hash);
    
    std::ostringstream ss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        ss << std::hex << std::setfill('0') << std::setw(2) << (int)hash[i];
    }
    return ss.str();
}

int main() {
    // ---- Read Input ----
    std::string input = readStdin();
    
    std::string seed = jsonGetString(input, "seed");
    std::vector<std::string> studentIds = jsonStringArray(input, "students");

    if (studentIds.empty()) {
        std::cout << "{\"seed\":\"" << escapeJson(seed) << "\",\"rankings\":[]}" << std::endl;
        return 0;
    }

    // ---- Generate Hashes ----
    std::vector<RankEntry> entries;
    for (auto& sid : studentIds) {
        RankEntry e;
        e.student_id = sid;
        e.hash = sha256(sid + seed);
        e.rank = 0;
        entries.push_back(e);
    }

    // ---- Sort by hash (lexicographic) ----
    std::sort(entries.begin(), entries.end(), [](const RankEntry& a, const RankEntry& b) {
        return a.hash < b.hash;
    });

    // ---- Assign ranks ----
    for (size_t i = 0; i < entries.size(); i++) {
        entries[i].rank = static_cast<int>(i + 1);
    }

    // ---- Output JSON ----
    std::cout << "{\"seed\":\"" << escapeJson(seed) << "\",\"rankings\":[";
    for (size_t i = 0; i < entries.size(); i++) {
        if (i > 0) std::cout << ",";
        std::cout << "{\"student_id\":\"" << escapeJson(entries[i].student_id)
                  << "\",\"hash\":\"" << entries[i].hash
                  << "\",\"rank\":" << entries[i].rank << "}";
    }
    std::cout << "]}" << std::endl;

    return 0;
}
