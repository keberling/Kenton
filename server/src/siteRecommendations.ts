import { reverseGeocodeAddress } from "./addressSearch.js";
import { haversineMeters } from "./geo.js";
import { store } from "./store.js";
import type { Photo } from "./types.js";

const CLUSTER_RADIUS_M = 2000;

export interface DeploymentRecommendation {
  id: string;
  photoCount: number;
  photoIds: string[];
  centroidLat: number;
  centroidLng: number;
  suggestedAddress: string | null;
  suggestedAddressSource: string | null;
}

function clusterPhotos(photos: Photo[]): Array<{ photos: Photo[]; centroidLat: number; centroidLng: number }> {
  const withGps = photos.filter((p) => p.lat != null && p.lng != null);
  const clusters: Array<{ photos: Photo[]; centroidLat: number; centroidLng: number }> = [];

  for (const photo of withGps) {
    const lat = photo.lat!;
    const lng = photo.lng!;

    let cluster = clusters.find((candidate) => {
      const distance = haversineMeters(lat, lng, candidate.centroidLat, candidate.centroidLng);
      return distance <= CLUSTER_RADIUS_M;
    });

    if (!cluster) {
      cluster = { photos: [], centroidLat: lat, centroidLng: lng };
      clusters.push(cluster);
    }

    const count = cluster.photos.length;
    cluster.centroidLat = (cluster.centroidLat * count + lat) / (count + 1);
    cluster.centroidLng = (cluster.centroidLng * count + lng) / (count + 1);
    cluster.photos.push(photo);
  }

  return clusters.sort((a, b) => b.photos.length - a.photos.length);
}

export async function buildDeploymentRecommendations(
  photos?: Photo[],
): Promise<DeploymentRecommendation[]> {
  const unassigned = photos ?? store.listPhotos({ unassigned: true });
  const needsSite = unassigned.filter((photo) => photo.lat != null && photo.lng != null);
  const clusters = clusterPhotos(needsSite);

  const recommendations: DeploymentRecommendation[] = [];

  for (const [index, cluster] of clusters.entries()) {
    const reverse = await reverseGeocodeAddress(cluster.centroidLat, cluster.centroidLng);
    recommendations.push({
      id: `cluster-${index}-${cluster.photos[0]?.id ?? index}`,
      photoCount: cluster.photos.length,
      photoIds: cluster.photos.map((p) => p.id),
      centroidLat: cluster.centroidLat,
      centroidLng: cluster.centroidLng,
      suggestedAddress: reverse?.label ?? null,
      suggestedAddressSource: reverse?.source ?? null,
    });
  }

  return recommendations;
}