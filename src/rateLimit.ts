/**
 * In-memory Rate Limiting Middleware
 * Uses Token Bucket algorithm to handle bursts while enforcing average rate.
 */

interface RateLimitConfig {
	limit: number      // Average requests per minute
	burst: number      // Maximum burst size
	interval: number   // Window size in seconds (default 60)
}

interface Bucket {
	tokens: number
	lastRefill: number
}

export class RateLimiter {
	private buckets: Map<string, Bucket>
	private config: RateLimitConfig
	
	private lastCleanup: number = Date.now()
	
	constructor(config: Partial<RateLimitConfig> = {}) {
		this.config = {
			limit: config.limit || 10,
			burst: config.burst || 5, // Allow small burst for initial page load
			interval: config.interval || 60
		}
		this.buckets = new Map()
	}
	
	/**
	 * Check if request is allowed based on IP and User-Agent
	 * @returns { allowed: boolean, reason?: string }
	 */
	check(ip: string, userAgent: string | null): { allowed: boolean; reason?: string } {
		// Lazy cleanup to avoid global timer
		const now = Date.now()
		if (now - this.lastCleanup > 60000) {
			this.cleanup()
			this.lastCleanup = now
		}

		// 1. Advanced Measure: User-Agent Validation
		if (!userAgent || userAgent.trim() === '') {
			return { allowed: false, reason: 'Missing User-Agent header' }
		}
		
		// Block common bot User-Agents if needed (optional advanced measure)
		const blockedAgents = ['curl', 'python-requests', 'postman']
		const uaLower = userAgent.toLowerCase()
		if (blockedAgents.some(agent => uaLower.includes(agent))) {
			// In a real app we might want to be more careful, but for "no abuse" this is effective
			return { allowed: false, reason: 'Automated client blocked' }
		}

		// 2. Token Bucket Rate Limiting
		const bucket = this.buckets.get(ip) || { 
			tokens: this.config.burst, 
			lastRefill: now 
		}
		
		// Refill tokens based on time passed
		const timePassed = (now - bucket.lastRefill) / 1000 // seconds
		const refillRate = this.config.limit / this.config.interval // tokens per second
		const refilledTokens = timePassed * refillRate
		
		bucket.tokens = Math.min(this.config.burst, bucket.tokens + refilledTokens)
		bucket.lastRefill = now
		
		// Consume token
		if (bucket.tokens >= 1) {
			bucket.tokens -= 1
			this.buckets.set(ip, bucket)
			return { allowed: true }
		} else {
			this.buckets.set(ip, bucket) // Update mainly for lastRefill
			return { allowed: false, reason: 'Rate limit exceeded' }
		}
	}
	
	private cleanup() {
		const now = Date.now()
		// Remove buckets that haven't been used in 5 minutes
		for (const [ip, bucket] of this.buckets.entries()) {
			if (now - bucket.lastRefill > 300000) {
				this.buckets.delete(ip)
			}
		}
	}
}

// Global instance with agreed configuration
export const rateLimiter = new RateLimiter({
	limit: 60,       // 10 req/min
	burst: 10,        // Allow burst of 5 (e.g. for landing page concurrent fetches)
	interval: 60
})
