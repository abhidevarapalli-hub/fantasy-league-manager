import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LeagueConfig } from '@/lib/roster-validation';

export interface MockDraftPick {
    round: number;
    position: number;
    playerId: string;
    teamIndex: number;
}

export interface MockDraft {
    id: string;
    createdAt: string;
    config: LeagueConfig;
    userPosition: number;
    status: 'setup' | 'in_progress' | 'completed';
    picks: MockDraftPick[];
    currentRound: number;
    currentPickIndex: number;
    teamRosters: Record<number, string[]>;
}

interface MockStoreState {
    drafts: Record<string, MockDraft>;
    createDraft: (config: LeagueConfig, userPosition: number) => string;
    deleteDraft: (id: string) => void;
    updateDraft: (id: string, updates: Partial<MockDraft>) => void;
    getDraft: (id: string) => MockDraft | undefined;
}

export const useMockStore = create<MockStoreState>()(
    persist(
        (set, get) => ({
            drafts: {},

            createDraft: (config, userPosition) => {
                const id = crypto.randomUUID();
                const newDraft: MockDraft = {
                    id,
                    createdAt: new Date().toISOString(),
                    config,
                    userPosition,
                    status: 'in_progress',
                    picks: [],
                    currentRound: 1,
                    currentPickIndex: 0,
                    teamRosters: {},
                };

                set((state) => ({
                    drafts: { ...state.drafts, [id]: newDraft }
                }));

                return id;
            },

            deleteDraft: (id) => {
                set((state) => {
                    const { [id]: _, ...rest } = state.drafts;
                    return { drafts: rest };
                });
            },

            updateDraft: (id, updates) => {
                set((state) => {
                    const draft = state.drafts[id];
                    if (!draft) return state;
                    return {
                        drafts: {
                            ...state.drafts,
                            [id]: { ...draft, ...updates }
                        }
                    };
                });
            },

            getDraft: (id) => {
                return get().drafts[id];
            }
        }),
        {
            name: 'mock-draft-storage',
        }
    )
);
