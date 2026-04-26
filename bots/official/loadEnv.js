import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

export function loadOfficialBotEnv(cwd = process.cwd()) {
  loadDotenv({
    path: path.join(cwd, '.env'),
  });

  loadDotenv({
    path: path.join(cwd, '.env.local'),
    override: true,
  });
}

export default {
  loadOfficialBotEnv,
};
