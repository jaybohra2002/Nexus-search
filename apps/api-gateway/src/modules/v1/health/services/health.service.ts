export class HealthService {
  static async checkSystemHealth() {
    return { status: 'ok', service: 'api-gateway', version: 'v1' };
  }
}
