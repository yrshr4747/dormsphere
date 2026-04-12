import { query } from '../db/connection';

interface WaveConfig {
  name: string;
  yearGroup: number;
  gateOpen: Date;
  gateClose: Date;
}

export async function createWave(config: WaveConfig): Promise<any> {
  const { rows } = await query(
    'INSERT INTO waves (name, year_group, gate_open, gate_close, is_active) VALUES ($1, $2, $3, $4, false) RETURNING *',
    [config.name, config.yearGroup, config.gateOpen, config.gateClose],
  );
  return rows[0];
}

export async function activateNextWave(): Promise<any> {
  const { rows } = await query(
    'UPDATE waves SET is_active = true WHERE id = (SELECT id FROM waves WHERE gate_open <= NOW() AND gate_close > NOW() AND is_active = false ORDER BY gate_open LIMIT 1) RETURNING *',
  );
  return rows[0] || null;
}

export async function getActiveWave(): Promise<any> {
  const { rows } = await query('SELECT * FROM waves WHERE is_active = true LIMIT 1');
  return rows[0] || null;
}

export async function deactivateExpiredWaves(): Promise<number> {
  const { rowCount } = await query(
    'UPDATE waves SET is_active = false WHERE gate_close <= NOW() AND is_active = true',
  );
  return rowCount || 0;
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
          message: `Wave "${activated.name}" for Year ${activated.year_group} is now open!`,
          wave: activated,
        });
      }
    } catch (err) {
      console.error('Wave scheduler error:', err);
    }
  }, 30000); // Check every 30s
}
