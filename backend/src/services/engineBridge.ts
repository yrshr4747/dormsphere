import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

// In Docker the binaries live at /app/engines/build; locally at ../../engines/build
const DOCKER_PATH = '/app/engines/build';
const LOCAL_PATH = path.resolve(__dirname, '../../../engines/build');
const ENGINES_DIR = fs.existsSync(DOCKER_PATH) ? DOCKER_PATH : LOCAL_PATH;

interface EngineResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function runEngine(engineName: string, input: string): Promise<EngineResult> {
  return new Promise((resolve, reject) => {
    const enginePath = path.join(ENGINES_DIR, engineName);
    
    const child = execFile(enginePath, [], { timeout: 30000 }, (error, stdout, stderr) => {
      if (error && error.killed) {
        reject(new Error(`Engine ${engineName} timed out (30s)`));
        return;
      }
      resolve({
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: error ? (error.code ? parseInt(String(error.code)) : 1) : 0,
      });
    });

    if (child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

export async function runGaleShapley(students: any[]): Promise<any> {
  const result = await runEngine('gale_shapley', JSON.stringify(students));
  return JSON.parse(result.stdout);
}

export async function runLottery(studentIds: string[], seed: string): Promise<any> {
  const input = JSON.stringify({ students: studentIds, seed });
  const result = await runEngine('lottery_engine', input);
  return JSON.parse(result.stdout);
}

export async function runConflictResolver(rooms: number, studentsPerRoom: number = 3, roomCapacity: number = 2): Promise<any> {
  const input = JSON.stringify({ rooms, students_per_room: studentsPerRoom, room_capacity: roomCapacity });
  const result = await runEngine('conflict_resolver', input);
  return JSON.parse(result.stdout);
}
