import { GovernorError, GovernorErrorCode } from "./errors";
import { createRetry, isNetworkError, type RetryFunction } from "./utils";
import type {
  GovernorConfig,
  TuningConfig,
  TuningRecommendation,
  TuningRecommendationPage,
} from "./types";

function mapRecommendation(raw: any): TuningRecommendation {
  return {
    id: Number(raw.id),
    computedAt: raw.computed_at,
    currentQuorumNumerator: Number(raw.current_quorum_numerator),
    recommendedQuorumNumerator: Number(raw.recommended_quorum_numerator),
    currentProposalThreshold: BigInt(raw.current_proposal_threshold),
    recommendedProposalThreshold: BigInt(raw.recommended_proposal_threshold),
    rationale: raw.rationale,
    autoProposed: Boolean(raw.auto_proposed),
    proposalId: raw.proposal_id === null || raw.proposal_id === undefined ? null : BigInt(raw.proposal_id),
  };
}

function mapConfig(raw: any): TuningConfig {
  return {
    minQuorumNumerator: Number(raw.min_quorum_numerator),
    maxQuorumNumerator: Number(raw.max_quorum_numerator),
    maxQuorumDeltaBps: Number(raw.max_quorum_delta_bps),
    minProposalThreshold: BigInt(raw.min_proposal_threshold),
    maxProposalThreshold: raw.max_proposal_threshold === null ? null : BigInt(raw.max_proposal_threshold),
    maxThresholdDeltaBps: Number(raw.max_threshold_delta_bps),
    trailingWindow: Number(raw.trailing_window),
    intervalMs: Number(raw.interval_ms),
    autoPropose: Boolean(raw.auto_propose),
    updatedAt: raw.updated_at,
  };
}

/**
 * Client for the governance tuning recommender (issue #998).
 *
 * Unlike every other indexer-backed client in this SDK (e.g.
 * {@link ReputationClient}'s `getScore`/`getLeaderboard`), this one talks
 * to the **backend** (`backend/src/routes/governance-tuning.ts`), not the
 * indexer or Soroban RPC — the recommender's state (recommendations,
 * tunable config) lives in the backend's Postgres schema, not the
 * indexer's. Requires `config.backendUrl` to be set.
 *
 * @example
 * const client = new GovernanceTuningClient({ ...config, backendUrl: "https://api.nebgov.dev" });
 * const latest = await client.getLatestRecommendation();
 */
export class GovernanceTuningClient {
  private readonly config: GovernorConfig;
  private readonly retry: RetryFunction;

  constructor(config: GovernorConfig) {
    this.config = config;
    this.retry = createRetry(config, { retryOn: isNetworkError });
  }

  private async backendRequest<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.config.backendUrl) {
      throw new GovernorError(
        GovernorErrorCode.SimulationFailed,
        `GovernanceTuningClient requires config.backendUrl to be set`,
      );
    }
    return this.retry(async () => {
      const resp = await fetch(`${this.config.backendUrl}${path}`, init);
      if (!resp.ok) {
        throw new GovernorError(
          GovernorErrorCode.SimulationFailed,
          `Backend request failed: ${resp.status}`,
        );
      }
      return resp.json() as Promise<T>;
    });
  }

  /**
   * Fetch the most recently computed recommendation.
   *
   * Hits `GET /governance-tuning/recommendations/latest`. Returns `null`
   * if the analyzer hasn't completed a cycle yet.
   */
  async getLatestRecommendation(): Promise<TuningRecommendation | null> {
    const raw = await this.backendRequest<any>("/governance-tuning/recommendations/latest");
    return raw === null ? null : mapRecommendation(raw);
  }

  /**
   * Fetch past recommendations as a flat array, newest first.
   *
   * Hits `GET /governance-tuning/recommendations`. For pagination metadata
   * (e.g. "load more" UI), use {@link getRecommendationHistoryPage} instead.
   *
   * @param limit  - Maximum number of entries to return (default 20, max 100 per the backend)
   * @param offset - Number of entries to skip for pagination (default 0)
   */
  async getRecommendationHistory(limit = 20, offset = 0): Promise<TuningRecommendation[]> {
    const { recommendations } = await this.getRecommendationHistoryPage(limit, offset);
    return recommendations;
  }

  /**
   * Fetch a single page of recommendations with pagination metadata.
   *
   * Hits `GET /governance-tuning/recommendations`.
   *
   * @param limit  - Page size (default 20, max 100 per the backend)
   * @param offset - Page offset (default 0)
   */
  async getRecommendationHistoryPage(limit = 20, offset = 0): Promise<TuningRecommendationPage> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const raw = await this.backendRequest<any>(`/governance-tuning/recommendations?${params}`);
    return {
      recommendations: (raw.data as any[]).map(mapRecommendation),
      pagination: raw.pagination,
    };
  }

  /**
   * Fetch the recommender's current tunable config (bands, per-cycle delta
   * caps, interval, auto-propose toggle).
   *
   * Hits `GET /governance-tuning/config`.
   */
  async getConfig(): Promise<TuningConfig> {
    const raw = await this.backendRequest<any>("/governance-tuning/config");
    return mapConfig(raw);
  }

  /**
   * Admin-only partial update of the tunable config.
   *
   * Hits `PUT /governance-tuning/config`. Requires the backend's
   * `ADMIN_SECRET` header to be set via `config.adminSecret`.
   */
  async updateConfig(
    patch: Partial<Omit<TuningConfig, "updatedAt">>,
  ): Promise<TuningConfig> {
    if (!this.config.adminSecret) {
      throw new GovernorError(
        GovernorErrorCode.SimulationFailed,
        `GovernanceTuningClient.updateConfig requires config.adminSecret to be set`,
      );
    }

    const body: Record<string, unknown> = {};
    if (patch.minQuorumNumerator !== undefined) body.min_quorum_numerator = patch.minQuorumNumerator;
    if (patch.maxQuorumNumerator !== undefined) body.max_quorum_numerator = patch.maxQuorumNumerator;
    if (patch.maxQuorumDeltaBps !== undefined) body.max_quorum_delta_bps = patch.maxQuorumDeltaBps;
    if (patch.minProposalThreshold !== undefined) body.min_proposal_threshold = patch.minProposalThreshold.toString();
    if (patch.maxProposalThreshold !== undefined) body.max_proposal_threshold = patch.maxProposalThreshold === null ? null : patch.maxProposalThreshold.toString();
    if (patch.maxThresholdDeltaBps !== undefined) body.max_threshold_delta_bps = patch.maxThresholdDeltaBps;
    if (patch.trailingWindow !== undefined) body.trailing_window = patch.trailingWindow;
    if (patch.intervalMs !== undefined) body.interval_ms = patch.intervalMs;
    if (patch.autoPropose !== undefined) body.auto_propose = patch.autoPropose;

    const raw = await this.backendRequest<any>("/governance-tuning/config", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-ADMIN-SECRET": this.config.adminSecret,
      },
      body: JSON.stringify(body),
    });
    return mapConfig(raw);
  }
}
