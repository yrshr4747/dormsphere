/**
 * DormSphere — 3D Gale-Shapley Stable Roommate Matching Engine
 * 
 * Input (stdin JSON):
 * [
 *   {"id":"s1","name":"Alice","sleep":8,"study":6,"social":3},
 *   {"id":"s2","name":"Bob","sleep":7,"study":7,"social":4},
 *   ...
 * ]
 *
 * Output (stdout JSON):
 * {
 *   "matches": [
 *     {"student_a":"s1","student_b":"s2","score":87.5},
 *     ...
 *   ],
 *   "unmatched": ["s5"],
 *   "stats": {"total":10,"matched":8,"avg_score":82.3}
 * }
 */

#include "common.h"
#include <algorithm>
#include <map>
#include <set>
#include <queue>
#include <iomanip>

using namespace dormsphere;

struct Proposal {
    int proposer;
    int target;
    double score;
};

int main() {
    // ---- Read Input ----
    std::string input = readStdin();
    auto items = jsonArrayItems(input);
    
    std::vector<Student> students;
    for (auto& item : items) {
        Student s;
        s.id = jsonGetString(item, "id");
        s.name = jsonGetString(item, "name");
        s.lifestyle.sleep = jsonGetNumber(item, "sleep");
        s.lifestyle.study = jsonGetNumber(item, "study");
        s.lifestyle.social = jsonGetNumber(item, "social");
        students.push_back(s);
    }

    int n = students.size();
    
    if (n == 0) {
        std::cout << "{\"matches\":[],\"unmatched\":[],\"stats\":{\"total\":0,\"matched\":0,\"avg_score\":0}}" << std::endl;
        return 0;
    }

    // ---- Build Compatibility Matrix ----
    std::vector<std::vector<double>> compat(n, std::vector<double>(n, 0.0));
    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            double score = students[i].lifestyle.compatibility(students[j].lifestyle);
            compat[i][j] = score;
            compat[j][i] = score;
        }
    }

    // ---- Build Ranked Preference Lists (sorted by descending compatibility) ----
    std::vector<std::vector<int>> prefLists(n);
    for (int i = 0; i < n; i++) {
        std::vector<std::pair<double, int>> scored;
        for (int j = 0; j < n; j++) {
            if (i != j) {
                scored.push_back({compat[i][j], j});
            }
        }
        std::sort(scored.begin(), scored.end(), [](auto& a, auto& b) {
            return a.first > b.first; // descending
        });
        for (auto& [score, idx] : scored) {
            prefLists[i].push_back(idx);
        }
    }

    // ---- Modified Gale-Shapley for Stable Roommates ----
    // Phase 1: Each person proposes to their most preferred unproposed partner
    std::vector<int> partner(n, -1);       // current partner (-1 = free)
    std::vector<int> proposeIdx(n, 0);     // index into preference list
    std::vector<bool> free(n, true);

    // Create rank lookup: rank[i][j] = position of j in i's preference list
    std::vector<std::map<int, int>> rank(n);
    for (int i = 0; i < n; i++) {
        for (int r = 0; r < (int)prefLists[i].size(); r++) {
            rank[i][prefLists[i][r]] = r;
        }
    }

    std::queue<int> freeQueue;
    for (int i = 0; i < n; i++) freeQueue.push(i);

    while (!freeQueue.empty()) {
        int proposer = freeQueue.front();
        freeQueue.pop();

        if (!free[proposer]) continue;
        if (proposeIdx[proposer] >= (int)prefLists[proposer].size()) continue;

        int target = prefLists[proposer][proposeIdx[proposer]];
        proposeIdx[proposer]++;

        if (free[target]) {
            // Target is free — accept
            partner[proposer] = target;
            partner[target] = proposer;
            free[proposer] = false;
            free[target] = false;
        } else {
            // Target is taken — compare
            int currentPartner = partner[target];
            if (rank[target].count(proposer) && rank[target].count(currentPartner) &&
                rank[target][proposer] < rank[target][currentPartner]) {
                // Target prefers proposer over current partner
                free[currentPartner] = true;
                partner[currentPartner] = -1;
                freeQueue.push(currentPartner);

                partner[proposer] = target;
                partner[target] = proposer;
                free[proposer] = false;
            } else {
                // Rejected — proposer continues
                freeQueue.push(proposer);
            }
        }
    }

    // ---- Collect Results ----
    std::vector<MatchResult> matches;
    std::set<int> matched;
    std::vector<std::string> unmatched;

    for (int i = 0; i < n; i++) {
        if (partner[i] != -1 && matched.find(i) == matched.end()) {
            int j = partner[i];
            matched.insert(i);
            matched.insert(j);
            matches.push_back({students[i].id, students[j].id, compat[i][j]});
        }
    }

    for (int i = 0; i < n; i++) {
        if (matched.find(i) == matched.end()) {
            unmatched.push_back(students[i].id);
        }
    }

    double avgScore = 0.0;
    if (!matches.empty()) {
        for (auto& m : matches) avgScore += m.score;
        avgScore /= matches.size();
    }

    // ---- Output JSON ----
    std::cout << std::fixed << std::setprecision(1);
    std::cout << "{\"matches\":[";
    for (size_t i = 0; i < matches.size(); i++) {
        if (i > 0) std::cout << ",";
        std::cout << "{\"student_a\":\"" << escapeJson(matches[i].student_a)
                  << "\",\"student_b\":\"" << escapeJson(matches[i].student_b)
                  << "\",\"score\":" << matches[i].score << "}";
    }
    std::cout << "],\"unmatched\":[";
    for (size_t i = 0; i < unmatched.size(); i++) {
        if (i > 0) std::cout << ",";
        std::cout << "\"" << escapeJson(unmatched[i]) << "\"";
    }
    std::cout << "],\"stats\":{\"total\":" << n
              << ",\"matched\":" << (int)matched.size()
              << ",\"avg_score\":" << avgScore << "}}" << std::endl;

    return 0;
}
