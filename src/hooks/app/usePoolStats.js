        sixStarPulls.push(pullRecord);
        if (isUp) {
          upSixStarHits.push(pullRecord);
          recordHitIntervalHit(targetSixStarIntervalTracker, { isSpark, isFree, countOverride: isFree ? 30 : undefined });
        }
        if (isActuallyLimited) {
          limitedSixStarHits.push(pullRecord);
          recordHitIntervalHit(limitedSixStarIntervalTracker, { isSpark, isFree, countOverride: isFree ? 30 : undefined });
        }