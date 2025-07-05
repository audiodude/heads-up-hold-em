export class HandEvaluator {
  constructor() {
    this.rankValues = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    
    this.handRankings = {
      HIGH_CARD: 1,
      PAIR: 2,
      TWO_PAIR: 3,
      THREE_OF_A_KIND: 4,
      STRAIGHT: 5,
      FLUSH: 6,
      FULL_HOUSE: 7,
      FOUR_OF_A_KIND: 8,
      STRAIGHT_FLUSH: 9,
      ROYAL_FLUSH: 10
    };
  }

  evaluate(holeCards, communityCards) {
    const allCards = [...holeCards, ...communityCards];
    const bestHand = this.findBestHand(allCards);
    return bestHand;
  }

  findBestHand(cards) {
    const combinations = this.getCombinations(cards, 5);
    let bestHand = null;
    let bestRank = 0;

    for (const combination of combinations) {
      const hand = this.evaluateHand(combination);
      if (hand.rank > bestRank || 
          (hand.rank === bestRank && this.compareSameRank(hand, bestHand) > 0)) {
        bestHand = hand;
        bestRank = hand.rank;
      }
    }

    return bestHand;
  }

  getCombinations(cards, r) {
    const combinations = [];
    const n = cards.length;
    
    function backtrack(start, current) {
      if (current.length === r) {
        combinations.push([...current]);
        return;
      }
      
      for (let i = start; i < n; i++) {
        current.push(cards[i]);
        backtrack(i + 1, current);
        current.pop();
      }
    }
    
    backtrack(0, []);
    return combinations;
  }

  evaluateHand(cards) {
    const ranks = cards.map(card => this.rankValues[card.rank]).sort((a, b) => b - a);
    const suits = cards.map(card => card.suit);
    
    const isFlush = suits.every(suit => suit === suits[0]);
    const isStraight = this.isStraight(ranks);
    const isRoyalStraight = this.isRoyalStraight(ranks);
    
    const rankCounts = this.getRankCounts(ranks);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    
    if (isFlush && isRoyalStraight) {
      return { rank: this.handRankings.ROYAL_FLUSH, values: [14] };
    }
    
    if (isFlush && isStraight) {
      return { rank: this.handRankings.STRAIGHT_FLUSH, values: [ranks[0]] };
    }
    
    if (counts[0] === 4) {
      const fourKind = this.getRankByCount(rankCounts, 4);
      const kicker = this.getRankByCount(rankCounts, 1);
      return { rank: this.handRankings.FOUR_OF_A_KIND, values: [fourKind, kicker] };
    }
    
    if (counts[0] === 3 && counts[1] === 2) {
      const threeKind = this.getRankByCount(rankCounts, 3);
      const pair = this.getRankByCount(rankCounts, 2);
      return { rank: this.handRankings.FULL_HOUSE, values: [threeKind, pair] };
    }
    
    if (isFlush) {
      return { rank: this.handRankings.FLUSH, values: ranks };
    }
    
    if (isStraight) {
      return { rank: this.handRankings.STRAIGHT, values: [ranks[0]] };
    }
    
    if (counts[0] === 3) {
      const threeKind = this.getRankByCount(rankCounts, 3);
      const kickers = ranks.filter(r => r !== threeKind).sort((a, b) => b - a);
      return { rank: this.handRankings.THREE_OF_A_KIND, values: [threeKind, ...kickers] };
    }
    
    if (counts[0] === 2 && counts[1] === 2) {
      const pairs = Object.keys(rankCounts)
        .filter(rank => rankCounts[rank] === 2)
        .map(rank => parseInt(rank))
        .sort((a, b) => b - a);
      const kicker = this.getRankByCount(rankCounts, 1);
      return { rank: this.handRankings.TWO_PAIR, values: [pairs[0], pairs[1], kicker] };
    }
    
    if (counts[0] === 2) {
      const pair = this.getRankByCount(rankCounts, 2);
      const kickers = ranks.filter(r => r !== pair).sort((a, b) => b - a);
      return { rank: this.handRankings.PAIR, values: [pair, ...kickers] };
    }
    
    return { rank: this.handRankings.HIGH_CARD, values: ranks };
  }

  isStraight(ranks) {
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
    if (uniqueRanks.length !== 5) return false;
    
    for (let i = 1; i < uniqueRanks.length; i++) {
      if (uniqueRanks[i-1] - uniqueRanks[i] !== 1) {
        if (uniqueRanks[0] === 14 && uniqueRanks[1] === 5 && uniqueRanks[4] === 2) {
          return true;
        }
        return false;
      }
    }
    return true;
  }

  isRoyalStraight(ranks) {
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
    return uniqueRanks.length === 5 && 
           uniqueRanks[0] === 14 && uniqueRanks[1] === 13 && 
           uniqueRanks[2] === 12 && uniqueRanks[3] === 11 && uniqueRanks[4] === 10;
  }

  getRankCounts(ranks) {
    const counts = {};
    for (const rank of ranks) {
      counts[rank] = (counts[rank] || 0) + 1;
    }
    return counts;
  }

  getRankByCount(rankCounts, count) {
    return parseInt(Object.keys(rankCounts).find(rank => rankCounts[rank] === count));
  }

  compare(hand1, hand2) {
    if (hand1.rank !== hand2.rank) {
      return hand1.rank - hand2.rank;
    }
    
    return this.compareSameRank(hand1, hand2);
  }

  compareSameRank(hand1, hand2) {
    for (let i = 0; i < Math.min(hand1.values.length, hand2.values.length); i++) {
      if (hand1.values[i] !== hand2.values[i]) {
        return hand1.values[i] - hand2.values[i];
      }
    }
    return 0;
  }
}