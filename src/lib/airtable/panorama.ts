import { listRecords, isMockMode } from "./client";
import { EVENTOS_TABLE, EVENT_FIELDS } from "./fields";
import { listUpcomingProjects } from "./projects";
import { getStandalonesTotalsByYear } from "./standalones";
import { getFeedsCapacityByYear } from "./feeds";

export interface PanoramaData {
  year: number;
  activeProjects: number;
  upcomingProjects: Awaited<ReturnType<typeof listUpcomingProjects>>;
  standalones: { totalEvents: number; distinctShows: number } | null;
  feedsPeak: { peakFeeds: number; peakMonth?: string | null } | null;
}

const INACTIVE = ["done", "completed", "cancelled", "wont do", "closed", "finalizado", "finalizada"];

function looksActive(status?: string): boolean {
  if (!status) return false;
  const value = status.toLowerCase();
  return !INACTIVE.some((word) => value.includes(word));
}

export async function getPanorama(): Promise<PanoramaData> {
  const year = new Date().getFullYear();
  const upcomingPromise = listUpcomingProjects(4);
  const standalonesPromise = getStandalonesTotalsByYear(year).catch(() => null);
  const feedsPromise = getFeedsCapacityByYear(year).catch(() => null);

  if (isMockMode()) {
    const upcomingProjects = await upcomingPromise;
    return { year, activeProjects: 0, upcomingProjects, standalones: null, feedsPeak: null };
  }

  const [events, upcomingProjects, standalones, feedsPeak] = await Promise.all([
    listRecords(EVENTOS_TABLE),
    upcomingPromise,
    standalonesPromise,
    feedsPromise,
  ]);

  const activeProjects = events.filter((event) =>
    looksActive(event.fields[EVENT_FIELDS.status] as string | undefined)
  ).length;

  return {
    year,
    activeProjects,
    upcomingProjects,
    standalones: standalones
      ? { totalEvents: standalones.totalEvents, distinctShows: standalones.distinctShows }
      : null,
    feedsPeak: feedsPeak ? { peakFeeds: feedsPeak.peakFeeds, peakMonth: feedsPeak.peakMonth } : null,
  };
}
