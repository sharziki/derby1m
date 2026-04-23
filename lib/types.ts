export type TrackCondition = 'fast' | 'good' | 'sloppy' | 'muddy';
export type PaceScenario = 'slow' | 'honest' | 'fast';
export type RunningStyle = 'E' | 'E/P' | 'P' | 'S';

export type SilkPattern =
  | 'solid'
  | 'diamonds'
  | 'stripes'
  | 'quartered'
  | 'chevrons'
  | 'hoops';

export interface Silk {
  pattern: SilkPattern;
  primary: string;
  secondary: string;
}

export interface Horse {
  id: string;
  name: string;
  post_position: number;
  jockey?: string | null;
  trainer?: string | null;
  morning_line?: string | null;
  beyer_last_3: number[];
  running_style: RunningStyle;
  distance_aptitude: number;
  class_rating: number;
  surface_aptitude_dirt: number;
  surface_aptitude_wet?: number | null;
  pace_figure_avg: number;
  silk?: Silk | null;
}

export interface FieldFile {
  meta: {
    race: string;
    date: string;
    distance?: string;
    surface?: string;
    note?: string;
    updated?: string;
  };
  horses: Horse[];
}

export interface Scenario {
  track: TrackCondition;
  pace: PaceScenario;
  beliefs: Record<string, number>;
  iterations?: number;
  seed?: number | null;
}

export interface HorseResult {
  id: string;
  name: string;
  post_position: number;
  p_win: number;
  p_top3: number;
  p_top4: number;
  mean_finish: number;
  finish_histogram: number[];
}

export interface SimResponse {
  results: HorseResult[];
  scenario: Scenario;
  iterations: number;
  elapsed_ms: number;
  field_size: number;
}

export interface ResultFile {
  meta: {
    race: string;
    date: string;
    track?: string | null;
    pace?: string | null;
    final_time?: string | null;
    status: 'pending' | 'official';
    note?: string;
  };
  finish_order: { position: number; horse_id: string }[];
}

// ---------------------------------------------------------------------------
// Consensus feature — populated by scripts/hermes_consensus.py
// ---------------------------------------------------------------------------

export interface ExpertPickVerified {
  name: string;
  publication: string;
  status: 'verified';
  article_url: string;
  article_title: string;
  article_date: string;
  top_pick: string;
  other_picks: string[];
  longshot: string | null;
  fade: string | null;
  key_quote: string;
  quote_verified: true;
}

export interface ExpertPickUnavailable {
  name: string;
  publication?: string;
  status: 'unavailable';
  reason: string;
}

export type ExpertPick = ExpertPickVerified | ExpertPickUnavailable;

export interface AggregateSignalVerified {
  status: 'verified';
  summary: string;
  example_posts?: string[];
  top_threads?: string[];
}

export interface AggregateSignalUnavailable {
  status: 'unavailable';
  reason: string;
}

export type AggregateSignal = AggregateSignalVerified | AggregateSignalUnavailable;

export interface ConsensusFile {
  generated_at: string;
  generator: string;
  expert_picks: ExpertPick[];
  aggregate_signals: {
    x_twitter: AggregateSignal;
    reddit_horseracing: AggregateSignal;
  };
  consensus_ranking: { horse: string; mention_count: number; top_pick_count: number }[];
}
