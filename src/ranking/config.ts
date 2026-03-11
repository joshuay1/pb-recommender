// Ranking configuration defaults
export const RANK_CFG = {
	// Base static weights used as fallbacks
	weights: {
		similarity: 0.6, // theme/content similarity weight
		freshness: 0.2,  // freshness/newness weight
		quality: 0.2     // quality/popularity weight
	},

	// Click decay controls whether recent clicks are weighted more heavily
	clickDecay: {
		useClickDecay: true,
		windowSize: 20
	},

	// Cap how many recent signals are applied per project
	capPerProject: 10,

	// Adaptive learning hyperparameters
	adaptiveLearning: {
		learningRate: 0.25,
		maxContentWeight: 0.7,
		maxLocationWeight: 0.6
	}
};

export default RANK_CFG;
