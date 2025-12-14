export async function savePositions(projectId, positions) {
  try {
    // Save to localStorage
    localStorage.setItem(`dbml-positions-${projectId}`, JSON.stringify(positions));
  } catch (error) {
    console.error('Error saving positions:', error);
  }
}

export async function loadPositions(projectId) {
  try {
    const stored = localStorage.getItem(`dbml-positions-${projectId}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading positions from localStorage:', error);
  }

  return {};
}
