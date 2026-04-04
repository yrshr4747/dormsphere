import Wave from '../models/Wave';

interface WaveConfig {
  name: string;
  yearGroup: number;
  gateOpen: Date;
  gateClose: Date;
}

export async function createWave(config: WaveConfig): Promise<any> {
  const wave = await Wave.create({
    name: config.name,
    yearGroup: config.yearGroup,
    gateOpen: config.gateOpen,
    gateClose: config.gateClose,
    isActive: false,
  });
  return wave;
}

export async function activateNextWave(): Promise<any> {
  const now = new Date();
  const wave = await Wave.findOneAndUpdate(
    { gateOpen: { $lte: now }, gateClose: { $gt: now }, isActive: false },
    { isActive: true },
    { new: true, sort: { gateOpen: 1 } }
  );
  return wave;
}

export async function getActiveWave(): Promise<any> {
  return Wave.findOne({ isActive: true }).lean();
}

export async function deactivateExpiredWaves(): Promise<number> {
  const now = new Date();
  const result = await Wave.updateMany(
    { gateClose: { $lte: now }, isActive: true },
    { isActive: false }
  );
  return result.modifiedCount;
}

// Run periodic check
export function startWaveScheduler(io: any): void {
  setInterval(async () => {
    try {
      const expired = await deactivateExpiredWaves();
      if (expired > 0) {
        io.emit('wave:event', { type: 'gate_closed', message: 'A selection wave has ended.' });
      }

      const activated = await activateNextWave();
      if (activated) {
        io.emit('wave:event', {
          type: 'gate_opened',
          message: `Wave "${activated.name}" for Year ${activated.yearGroup} is now open!`,
          wave: activated,
        });
      }
    } catch (err) {
      console.error('Wave scheduler error:', err);
    }
  }, 30000); // Check every 30s
}
