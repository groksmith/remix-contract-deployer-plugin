import Web3 from 'web3'
import { AbiItem } from 'web3-utils'
import { createClient } from '@remixproject/plugin-webview'
import { PluginClient } from '@remixproject/plugin'
import { CompiledContract, ABIDescription, BytecodeObject } from '@remixproject/plugin-api'
import { json } from 'starknet'
import factoryContract from './factory.json'
import detectEthereumProvider from '@metamask/detect-provider';

import { useEffect, useRef, useState } from 'react'

import './App.css'

const networks = [
  {
    chainId: '0x1',
    chainDecimal: 1,
    name: 'Ethereum Main Network (Mainnet)'
  },
  {
    chainId: '0x3',
    chainDecimal: 3,
    name: 'Ropsten Test Network'
  },
  {
    chainId: '0x4',
    chainDecimal: 4,
    name: 'Rinkeby Test Network'
  },
  {
    chainId: '0x5',
    chainDecimal: 5,
    name: 'Goerli Test Network'
  },
  {
    chainId: '0x2a',
    chainDecimal: 42,
    name: 'Kovan Test Network'
  },
]

declare global {
  interface Window { web3: Web3 }
}

type ABIParameter = {
  internalType: string;
  name: string;
  type: string
}

type CompiledContractJSON = {
  data: {
    bytecode: BytecodeObject;
  }
}

type VariableType = { 
  [key: string]: {
    type: string;
    value: string
  }
}

const getHint = (str: string) => {
  if(str.includes('[]')) {
    return '- Arguments separated with comma' 
  }
  return ''
}

const arrayify = (str: string) => str.split(',').map(s => s.trim())
const makeHex = (str: string) => window.web3.utils.asciiToHex(str)

const encodeBytes = (params: string | string[]) => {
  if(Array.isArray(params)) {
    return params.map(makeHex)
  }
  return makeHex(params)
}

const getFilePath = async (client: PluginClient) => {
  let filePath = null;
  try {
    filePath = await client.call('fileManager', 'getCurrentFile');
  } catch (error) {
    filePath = null
  }
  return filePath
}

const genRanHex = (size = 16) => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

function App() {
  const client = useRef(createClient(new PluginClient()))
  const provider = useRef<any>(null);
  const [canParse, setCanParse] = useState(false);
  const [constructorInput, setConstructorInput] = useState<ABIDescription | null>(null)
  const [contractToDeploy, setContract] = useState<unknown>(null)
  const [customInput, setCustomInput] = useState<VariableType>({})
  const [accounts, setAccounts] = useState<string[]>([])
  const [salt, setSalt] = useState<string>('')
  const [depoyedAddress, setDeployedAddress] = useState<Array<{
    address: string;
    deployedDate: Date;
  }> | null>(null);
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<number>(0);

  const handleParsing = async () => {
    setError('')
    const filePath = await client.current.call('fileManager', 'getCurrentFile');
    const contractJson = await client.current.call('fileManager', 'readFile', filePath);
    const contract = json.parse(contractJson) as CompiledContract;
    const constructor = contract.abi.find((singleAbi) => singleAbi.type === 'constructor');

    if(constructor) {
      if(constructor.inputs && constructor.inputs.length > 0) {
        setConstructorInput(constructor)
      }
    } 

    setContract(contract)
  }

  const onNetworkChange = (networkDecimalId: string) => {
    const parsed = parseInt(networkDecimalId);
    const networkToChange = networks.find(n => n.chainDecimal === parsed);
    if(networkToChange) {
      setSelectedNetwork(parsed)
    }
  }

  useEffect(() => {
    const initWeb3 = async () => {
      // Events for inital load

      client.current.on('fileManager', 'currentFileChanged', async () => {
        const filePath = await getFilePath(client.current)
        setCanParse(!!filePath)
      })

      client.current.on('fileManager', 'noFileSelected', async () => {
        setCanParse(false)
      })

      const filePath = await getFilePath(client.current)
      setCanParse(!!filePath)
      

      // Init provider with metamask
      provider.current = window.ethereum
      
      if (provider.current) {
        await provider.current.request({ method: 'eth_requestAccounts' });
        provider.current.on('accountsChanged', (accounts: string[]) => {
          if(accounts.length > 0) {
            setAccounts(accounts)
          }
        })
        
        window.web3 = new Web3(provider.current);
        window.web3.eth.getAccounts((_, result) => {
          setAccounts(result);
        });
        const currentSelected = parseInt(provider.current.networkVersion);
        const selectedNetwork = networks.find(n => n.chainDecimal === currentSelected);

        if(selectedNetwork) {
          setSelectedNetwork(currentSelected)
        }

        provider.current.on('networkChanged', onNetworkChange);
      }
    }

    client.current.onload(async () => {
      await initWeb3()
    })

    return () => {
      client.current.off('fileManager', 'currentFileChanged')
      // eslint-disable-next-line react-hooks/exhaustive-deps
      client.current.off('fileManager', 'noFileSelected')
      if(provider.current) {
        provider.current.removeListener('networkChanged', onNetworkChange)
      }
    }
  }, [])    

  const handleCustomInput = (abi: ABIParameter) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomInput((oldState) => ({
      ...oldState,
      [abi.name]: {
        type: abi.type,
        value: e.target.value
      }
    }))
  }

  const resetState = () => {
    setConstructorInput(null)
    setContract(null)
    setCustomInput({})
    setSalt('')
    setLoading(false)
    setSelectedNetwork(parseInt(provider.current.networkVersion))
  }

  const handleVariableParsing = async () => {
    const encodedValues = Object.keys(customInput).map(key => {
      const param = customInput[key]
      const isArray = param.type.indexOf('[]') !== -1
      const params = isArray ? arrayify(param.value) : param.value
      
      if(param.type.indexOf('bytes') !== -1) {
        return {
          type: param.type,
          params: encodeBytes(params)
        }
      }

      return {
        type: param.type,
        params
      }
    })
    /**
     * This part is responsible for encoding the constructor parameters
     * because if the constructor has parameters those need to be given initially
     * with their defined type, so we need to encode them
     */
    const types = encodedValues.map(({ type }) => type)
    const values = encodedValues.map(({ params }) => params)
  
    const encodedParams = window.web3.eth.abi.encodeParameters(types, values).substring(2)

    const ctr = contractToDeploy as CompiledContractJSON
    // Conacting the compiled contract with encoded consturcor parameters
    const toDeploy = ctr.data.bytecode.object + encodedParams
    
    // Loading the factory contract
    const contract = new window.web3.eth.Contract(factoryContract.abi as AbiItem[], '0x56434E34E7771aa9680d09220Fe5d4D5c305323a');
    setLoading(true)
    await client.current.call('terminal', 'log', {
      value: 'Deploying contract',
      type: 'log'
    });
    contract.methods.deploy(`0x${toDeploy}`, salt)
      .send({ from: accounts[0] })
      .then(async () => {
        await client.current.call('terminal', 'log', {
          value: 'Contract deployed, retrieving address',
          type: 'log'
        });
        contract.methods.getAddress(`0x${toDeploy}`, salt)
          .call()
          .then(async (res: string) => {
            resetState()
            await client.current.call('terminal', 'log', {
              value: `Address received, deployed contract address: ${res}`,
              type: 'log'
            });
            const newAddress = {
              address: res,
              deployedDate: new Date()
            };

            setDeployedAddress((old) => old ? [newAddress, ...old] : [newAddress])
          })
      })
      .catch((err: any) => {
        if(err.code && err.code === 4001) { // From metamask docs, error thrown when user denies access to account
          setError(err.message)
        }
        resetState()

      })
  }

  const generateRandomSalt = () => {
    const randomSalt = genRanHex(14);
    setSalt(`0x${randomSalt}`);
  }

  const canDeploy = () => {
    // If all contstructor inputs are valid and entered
    // if constructor has two initial arguments, and only one given
    // the deploy will fail, thus we check for every argument to be entered and be valid
    if(constructorInput) {
      const inputs = Object.keys(customInput).map(key => !!customInput[key].value)
      const allInputs = constructorInput.inputs?.length
      
      if(inputs.length === 0 || inputs.length !== allInputs) {
        return false
      }
      return inputs.every(Boolean)
    } 

    return !!salt
  }

  const handleNetworkChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedNetwork(parseInt(e.target.value));
    const net = networks.find(n => n.chainDecimal === parseInt(e.target.value));

    try {
      await provider.current.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: net?.chainId }], })
    } catch (err: any) {
      if(err.code && err.code === 4001) { // From metamask docs, error thrown when user denies access to account
        setError(err.message)
      }
      resetState()
    }
  }

  return (
    <div className="container">
      Select compiled contract JSON
      <div role="button" className={`button ${canParse ? '' : 'disabled'}`} onClick={handleParsing}>
        load contract {!canParse ? <span className='info'>(No compiled json selected)</span> : ''}
      </div>
      {constructorInput ? (
        <>
          {constructorInput.inputs && constructorInput.inputs.map((input, idx) => {
            const inp = input as ABIParameter
            return (
              <div key={idx} className="input-row">
                <label htmlFor={`${idx}`}>{inp.name} {getHint(inp.internalType)}</label>
                <input id={`${idx}`} placeholder={inp.internalType} value={customInput[inp.name]?.value} onChange={handleCustomInput(inp)} />
              </div>
            )
          })}
        </>
      ) : null}

      {contractToDeploy ? (
        <>
          <label htmlFor="salt">Enter Salt</label>
          <div className='salt-container'>
            <input id="salt" placeholder="ex. 0x018716238712" value={salt} onChange={e => setSalt(e.target.value)} /> 
            <button className='generate-salt' onClick={generateRandomSalt}>generate</button>
          </div>
        </>
      ): null}

      {contractToDeploy && canDeploy() ? (
        <div className='networkList'>
          <label>Select network to deploy</label>
          <select value={selectedNetwork} onChange={handleNetworkChange}>
            {networks.map(n => <option key={n.chainId} value={n.chainDecimal}>{n.name}</option>)}
          </select>
          <div role="button" className="button" onClick={handleVariableParsing}>deploy</div>
        </div>
      ) : null}
      {isLoading ? 'Deploy in progress...' : null}
      {depoyedAddress ? (
        <div>
          <p>Deployed contract addresses:</p>
          {depoyedAddress.map((addr, idx) => (
            <div key={idx} className="copy-addr">
              <div className="date">Deployed on: {addr.deployedDate.toLocaleDateString()} {addr.deployedDate.toLocaleTimeString()}</div>
              <div className="contract-info">
                <div className="address">{addr.address}</div>
              </div>
            </div>
            ))}
        </div>
      ) : null}
      {error ? <div className="error">{error}</div> : null}
    </div>  
  )
}

export default App
