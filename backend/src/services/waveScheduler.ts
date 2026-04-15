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
  const { rows: activeRows } = await query(
    'SELECT id FROM waves WHERE is_active = true AND gate_open <= NOW() AND gate_close > NOW() LIMIT 1',
  );
  if (activeRows.length > 0) {
    return null;
  }

  const { rows } = await query(
    `UPDATE waves
     SET is_active = true, status = 'active'
     WHERE id = (
       SELECT id
       FROM waves
       WHERE gate_open <= NOW()
         AND gate_close > NOW()
         AND is_active = false
       ORDER BY gate_open
       LIMIT 1
     )
     RETURNING *`,
  );
  return rows[0] || null;
}

export async function getActiveWave(): Promise<any> {
  const { rows } = await query('SELECT * FROM waves WHERE is_active = true LIMIT 1');
  return rows[0] || null;
}

export async function deactivateExpiredWaves(): Promise<number> {
  const { rowCount } = await query(
    "UPDATE waves SET is_active = false, status = 'completed' WHERE gate_close <= NOW() AND (is_active = true OR status <> 'completed')",
  );
  return rowCount || 0;
}

export async function normalizeActiveWaves(): Promise<void> {
  const { rows } = await query(
    `SELECT id
     FROM waves
     WHERE gate_open <= NOW()
       AND gate_close > NOW()
     ORDER BY gate_open ASC, year_group DESC`
  );

  if (rows.length === 0) {
    await query(
      "UPDATE waves SET is_active = false, status = 'pending' WHERE gate_open > NOW() AND (is_active = true OR status = 'active')"
    );
    return;
  }

  const primaryWaveId = rows[0].id;
  const otherOpenWaveIds = rows.slice(1).map((row) => row.id);

  await query(
    "UPDATE waves SET is_active = true, status = 'active' WHERE id = $1",
    [primaryWaveId]
  );

  if (otherOpenWaveIds.length > 0) {
    await query(
      "UPDATE waves SET is_active = false, status = 'pending' WHERE id = ANY($1::uuid[])",
      [otherOpenWaveIds]
    );
  }

  await query(
    "UPDATE waves SET is_active = false, status = 'pending' WHERE gate_open > NOW() AND id <> $1 AND (is_active = true OR status = 'active')",
    [primaryWaveId]
  );
}

// Run periodic check
export function startWaveScheduler(io: any): void {
  const runTick = async () => {
    try {
      const expired = await deactivateExpiredWaves();
      if (expired > 0) {
        io.emit('wave:event', { type: 'gate_closed', message: 'A selection wave has ended.' });
      }

      await normalizeActiveWaves();

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
  };

  void runTick();
  setInterval(runTick, 30000); // Check every 30s
}
