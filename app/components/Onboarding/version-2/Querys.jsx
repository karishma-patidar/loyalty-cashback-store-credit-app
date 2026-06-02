export default function GetThemesQuery() {
  return `
    query GetThemes {
      themes(first: 50) {
        edges {
          node {
            id
            name
            role
            processing
            createdAt
            updatedAt
          }
        }
      }
    }
  `;
};
