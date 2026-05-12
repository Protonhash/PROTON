'use client';

import { useEffect, useState } from 'react';

interface Stats {
  total_miners: number;
  total_points_distributed: number;
  total_tasks_completed: number;
  active_miners: number;
  network_hashrate: number;
}

interface Miner {
  rank: number;
  username: string;
  points: number;
  tasks: number;
  tier: string;
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [leaderboard, setLeaderboard] = useState<Miner[]>([]);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    fetch(`${API_URL}/api/leaderboard/stats`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});

    fetch(`${API_URL}/api/leaderboard?limit=20`)
      .then(r => r.json())
      .then(data => setLeaderboard(data.miners || []))
      .catch(() => {});
  }, [API_URL]);

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-proton-primary/5 to-transparent" />
        <div className="relative mx-auto max-w-6xl text-center">
          <h1 className="mb-4 text-6xl font-bold tracking-tight">
            <span className="gradient-text">PROTON</span>
          </h1>
          <p className="mb-2 text-xl text-gray-400">
            AI Compute Mining for Solana
          </p>
          <p className="mb-8 text-sm text-gray-500">
            Mine with your CPU/GPU. Earn PROTON rewards. Join the network.
          </p>

          <div className="mx-auto mb-8 max-w-lg rounded-lg border border-proton-border bg-proton-card p-4">
            <code className="text-sm text-proton-primary">
              curl -sSL proton.fun/install.sh | bash && proton mine
            </code>
          </div>

          <div className="flex justify-center gap-4">
            <a
              href="https://github.com/Protonhash/PROTON"
              className="rounded-lg bg-proton-primary/10 px-6 py-3 font-semibold text-proton-primary transition hover:bg-proton-primary/20"
            >
              Start Mining
            </a>
            <a
              href="#leaderboard"
              className="rounded-lg border border-proton-border px-6 py-3 font-semibold text-gray-300 transition hover:border-proton-primary/50"
            >
              Leaderboard
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-proton-border bg-proton-card/50 px-6 py-12">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 md:grid-cols-4">
          <StatCard label="Active Miners" value={stats?.active_miners || 0} />
          <StatCard label="Total Miners" value={stats?.total_miners || 0} />
          <StatCard label="Tasks Completed" value={stats?.total_tasks_completed || 0} />
          <StatCard label="Points Distributed" value={stats?.total_points_distributed || 0} />
        </div>
      </section>

      {/* Leaderboard */}
      <section id="leaderboard" className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-3xl font-bold text-white">
            Top Miners
          </h2>
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-proton-border bg-proton-dark/50 text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-6 py-4">Rank</th>
                  <th className="px-6 py-4">Miner</th>
                  <th className="px-6 py-4">Points</th>
                  <th className="px-6 py-4">Tasks</th>
                  <th className="px-6 py-4">Tier</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length > 0 ? (
                  leaderboard.map((miner) => (
                    <tr key={miner.rank} className="border-b border-proton-border/50 transition hover:bg-proton-primary/5">
                      <td className="px-6 py-4 font-mono font-bold text-proton-primary">
                        #{miner.rank}
                      </td>
                      <td className="px-6 py-4 font-semibold text-white">
                        {miner.username}
                      </td>
                      <td className="px-6 py-4 text-green-400">
                        {miner.points.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {miner.tasks.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <TierBadge tier={miner.tier} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No miners yet. Be the first!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-proton-border px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-12 text-3xl font-bold text-white">How It Works</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <StepCard step="1" title="Install" desc="One command to install the PROTON miner on any platform." />
            <StepCard step="2" title="Mine" desc="Your CPU/GPU computes AI workloads for the Solana ecosystem." />
            <StepCard step="3" title="Earn" desc="Accumulate points and receive PROTON token allocation." />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-proton-border px-6 py-8 text-center text-sm text-gray-500">
        <p>PROTON Network &copy; 2024. AI Compute for Solana.</p>
      </footer>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-white md:text-3xl">
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-xs text-gray-400">{label}</div>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    diamond: 'bg-cyan-500/20 text-cyan-300',
    platinum: 'bg-purple-500/20 text-purple-300',
    gold: 'bg-yellow-500/20 text-yellow-300',
    silver: 'bg-gray-400/20 text-gray-300',
    bronze: 'bg-orange-500/20 text-orange-300',
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[tier] || colors.bronze}`}>
      {tier}
    </span>
  );
}

function StepCard({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="glass rounded-xl p-6">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-proton-primary/10 text-lg font-bold text-proton-primary">
        {step}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm text-gray-400">{desc}</p>
    </div>
  );
}
