export const PostApi = async (url, data, val) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return await response.json();
}

export const HandleChange = (setState, name, value) => {
  setState((preValue) => {
    return {
      ...preValue,
      [name]: value
    }
  })
}