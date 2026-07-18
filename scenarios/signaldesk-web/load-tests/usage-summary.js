import http from 'k6/http'
import { check, sleep } from 'k6'

const baseUrl = __ENV.SCENARIO_BASE_URL
if (!baseUrl || !/^https?:\/\//.test(baseUrl)) throw new Error('Set SCENARIO_BASE_URL to the disposable SignalDesk staging URL.')

export const options = {
  vus: 100,
  duration: '60s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<450'],
  },
}

export default function () {
  const response = http.get(`${baseUrl}/api/usage/summary?workspaceId=legacy-acme`, { tags: { scenario: 'usage-summary' } })
  check(response, { 'summary returns 200': (result) => result.status === 200, 'summary contains usage': (result) => Number(JSON.parse(result.body).currentUsage) >= 0 })
  sleep(0.1)
}
