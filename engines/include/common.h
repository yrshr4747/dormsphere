#pragma once

#include <string>
#include <vector>
#include <cmath>
#include <sstream>
#include <iostream>

namespace dormsphere {

// ----- 3D Lifestyle Vector -----
struct Vector3D {
    double sleep;   // 0-10 scale
    double study;   // 0-10 scale  
    double social;  // 0-10 scale

    double magnitude() const {
        return std::sqrt(sleep * sleep + study * study + social * social);
    }

    Vector3D normalized() const {
        double mag = magnitude();
        if (mag < 1e-9) return {0, 0, 0};
        return {sleep / mag, study / mag, social / mag};
    }

    double dot(const Vector3D& other) const {
        return sleep * other.sleep + study * other.study + social * other.social;
    }

    // Cosine similarity → compatibility score [0, 100]
    double compatibility(const Vector3D& other) const {
        double magA = magnitude();
        double magB = other.magnitude();
        if (magA < 1e-9 || magB < 1e-9) return 0.0;
        double cosTheta = dot(other) / (magA * magB);
        // Clamp to [-1, 1] for numerical safety
        cosTheta = std::max(-1.0, std::min(1.0, cosTheta));
        // Map from [-1, 1] to [0, 100]
        return (cosTheta + 1.0) * 50.0;
    }
};

// ----- Student -----
struct Student {
    std::string id;
    std::string name;
    int year;           // 1-4
    Vector3D lifestyle;
};

// ----- Room -----
struct Room {
    std::string id;
    std::string hostel;
    int floor;
    int number;
    int capacity;       // typically 1 or 2
    int occupied;       // current occupancy
    bool available;
};

// ----- Match Result -----
struct MatchResult {
    std::string student_a;
    std::string student_b;
    double score; // 0-100 compatibility
};

// ----- Lottery Rank -----
struct LotteryRank {
    std::string student_id;
    std::string hash;
    int rank;
};

// ----- JSON helpers (minimal, no external deps) -----
inline std::string escapeJson(const std::string& s) {
    std::string out;
    for (char c : s) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\t': out += "\\t";  break;
            default:   out += c;
        }
    }
    return out;
}

// Simple JSON string value extraction
inline std::string jsonGetString(const std::string& json, const std::string& key) {
    std::string search = "\"" + key + "\"";
    size_t pos = json.find(search);
    if (pos == std::string::npos) return "";
    pos = json.find('"', pos + search.size() + 1);
    if (pos == std::string::npos) return "";
    size_t end = json.find('"', pos + 1);
    if (end == std::string::npos) return "";
    return json.substr(pos + 1, end - pos - 1);
}

// Simple JSON number value extraction
inline double jsonGetNumber(const std::string& json, const std::string& key) {
    std::string search = "\"" + key + "\"";
    size_t pos = json.find(search);
    if (pos == std::string::npos) return 0.0;
    pos = json.find(':', pos + search.size());
    if (pos == std::string::npos) return 0.0;
    pos++;
    while (pos < json.size() && (json[pos] == ' ' || json[pos] == '\t')) pos++;
    std::string numStr;
    while (pos < json.size() && (isdigit(json[pos]) || json[pos] == '.' || json[pos] == '-')) {
        numStr += json[pos++];
    }
    return numStr.empty() ? 0.0 : std::stod(numStr);
}

// Read all stdin into string
inline std::string readStdin() {
    std::ostringstream ss;
    ss << std::cin.rdbuf();
    return ss.str();
}

// Extract JSON array items (simple top-level array of objects)
inline std::vector<std::string> jsonArrayItems(const std::string& json) {
    std::vector<std::string> items;
    int depth = 0;
    size_t start = 0;
    bool inString = false;
    bool escaped = false;

    for (size_t i = 0; i < json.size(); i++) {
        char c = json[i];
        if (escaped) { escaped = false; continue; }
        if (c == '\\') { escaped = true; continue; }
        if (c == '"') { inString = !inString; continue; }
        if (inString) continue;

        if (c == '{') {
            if (depth == 0) start = i;
            depth++;
        } else if (c == '}') {
            depth--;
            if (depth == 0) {
                items.push_back(json.substr(start, i - start + 1));
            }
        }
    }
    return items;
}

// Extract string array items (e.g., ["a","b","c"])  
inline std::vector<std::string> jsonStringArray(const std::string& json, const std::string& key) {
    std::vector<std::string> result;
    std::string search = "\"" + key + "\"";
    size_t pos = json.find(search);
    if (pos == std::string::npos) return result;
    
    pos = json.find('[', pos);
    if (pos == std::string::npos) return result;
    
    size_t end = json.find(']', pos);
    if (end == std::string::npos) return result;
    
    std::string arr = json.substr(pos + 1, end - pos - 1);
    size_t i = 0;
    while (i < arr.size()) {
        size_t qStart = arr.find('"', i);
        if (qStart == std::string::npos) break;
        size_t qEnd = arr.find('"', qStart + 1);
        if (qEnd == std::string::npos) break;
        result.push_back(arr.substr(qStart + 1, qEnd - qStart - 1));
        i = qEnd + 1;
    }
    return result;
}

} // namespace dormsphere
